# ====== Variables ======
NS ?= default
K  := kubectl -n $(NS)

KAFKA_DIR   := apache_kafka
SPARK_DIR   := spark_k8
SPARK_CODE_DIR := spark_code
PRODUCER_DIR:= python_producer
MONGODB_DIR := mongodb
FASTAPI_DIR := fastapi
HPA_DIR        := hpa

.PHONY: start-kafka start-spark-pods start-mongodb start-python-producer \
        launch_producer submit_spark_job status pf-master pf-driver pf-mongodb \
        delete-resources delete-mongodb nuke query-stats query-attacks


# ------- Kafka (contrôleurs -> brokers) -------
start-kafka:
	$(K) apply -f $(KAFKA_DIR)/kafka_controller_statefulset.yaml
	$(K) wait --for=condition=ready pod -l app=kafka-controller --timeout=300s
	$(K) apply -f $(KAFKA_DIR)/kafka_broker_statefulset.yaml
	$(K) wait --for=condition=ready pod -l app=kafka-broker --timeout=300s
	$(K) apply -f $(KAFKA_DIR)/topic_job.yaml
	$(K) wait --for=condition=complete job/kafka-topic-creator --timeout=300s

# ------- Spark (master -> workers -> client) -------
start-spark-pods:
#	$(K) apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.34.0/controller.yaml --namespace=kube-system
	$(K) apply -f $(MONGODB_DIR)/mongodb-secret.yaml
#	$(K) wait --for=condition=Synced secret/mongodb-secret --timeout=30s
	$(K) apply -f $(SPARK_DIR)/spark_master_deployment.yaml
	$(K) rollout status deploy/spark-master --timeout=180s
	$(K) apply -f $(SPARK_DIR)/spark_worker_deployment.yaml
	$(K) rollout status deploy/spark-worker --timeout=300s
	$(K) apply -f $(SPARK_DIR)/spark_client_statefulset.yaml
	$(K) wait --for=condition=ready pod -l app=spark-client --timeout=180s

# ------- Producteur Python -------
start-python-producer:
	$(K) apply -f $(PRODUCER_DIR)/producer_deployment.yaml
	$(K) rollout status deploy/python-producer --timeout=300s
	$(K) logs -f deployment/python-producer

# ------- Job Spark -------
submit-spark-job:
	# copie le job et le script de submit dans le pod client
	$(K) cp $(SPARK_CODE_DIR)/spark_job.py spark-client-0:/opt/spark/work-dir/spark_job.py
	$(K) cp $(SPARK_CODE_DIR)/spark_submit.sh spark-client-0:/opt/spark/work-dir/spark_submit.sh
	# lance le job (peut prendre du temps la 1ère fois : téléchargement des packages)
	$(K) exec -it spark-client-0 -- /bin/bash /opt/spark/work-dir/spark_submit.sh

start-fastapi:
	$(K) apply -f $(FASTAPI_DIR)/ingress.yaml
	$(K) apply -f $(FASTAPI_DIR)/fastapi_deployement.yaml
	$(K) rollout status deploy/python-fastapi --timeout=300s
	@echo "here's the address to access fastapi endpoints"
	$(K) get ingress fastapi-ingress

launch-dashboard:
	cd dashboard_frontend && npm install && npm run dev

# ------- Autoscaling (HPA) -------
start-hpa:
	@echo "Applying HPA for Spark Workers and FastAPI..."
	$(K) apply -f $(HPA_DIR)/hpa_spark_worker.yaml
	$(K) apply -f $(HPA_DIR)/hpa_fastapi.yaml

status-hpa:
	@echo "== HPA Status =="
	$(K) get hpa

watch-scaling:
	@echo "Watching Spark Workers scaling (Ctrl+C to stop)..."
	$(K) get pods -l app=spark-worker -w

# ------- Mise à jour de la cible Status -------
status:
	@echo "== Pods ==" && $(K) get pods -o wide
	@echo "== HPA ==" && $(K) get hpa
	@echo "== Services ==" && $(K) get svc
	@echo "== PVC ==" && $(K) get pvc
	kubectl top nodes
	$(K) top pods

# ------- Dépendances Cluster -------
install-metrics-server:
	@echo "Installing Metrics Server..."
	$(K) apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
	@echo "Patching Metrics Server for insecure TLS (required for custom clusters)..."
	$(K) patch deployment metrics-server -n kube-system --type='json' -p='[{"op": "add", "path": "/spec/template/spec/containers/0/args/-", "value": "--kubelet-insecure-tls"}]'


# ============================================
# MONITORING TARGETS (Added by Wail)
# ============================================
# NOTE: before running this
# if you are on windows install helm (choco install kubernetes-helm)
# if you are on linux install helm (see https://helm.sh/docs/intro/install/#from-apt-debianubuntu)
setup-monitoring:
	$(K) create namespace monitoring || echo "Namespace already exists"
	helm repo add prometheus-community https://prometheus-community.github.io/helm-charts || echo "Repo already added"
	helm repo update
	helm install kube-prometheus-stack prometheus-community/kube-prometheus-stack --namespace monitoring --set prometheus.prometheusSpec.retention=30d --set grafana.adminPassword=admin --set grafana.service.type=NodePort --wait --timeout=10m
	@echo "=========================================="
	@echo "Monitoring deployed successfully!"
	@echo "Access Grafana: make access-grafana"
	@echo "Then open: http://localhost:3000"
	@echo "Username: admin | Password: admin"
	@echo "=========================================="

access-grafana:
	@echo "Opening Grafana at http://localhost:3000"
	@echo "Username: admin | Password: admin"
	$(K) port-forward -n monitoring svc/kube-prometheus-stack-grafana 3000:80

access-prometheus:
	@echo "Opening Prometheus at http://localhost:9090"
	$(K) port-forward -n monitoring svc/kube-prometheus-stack-prometheus 9090:9090

delete-monitoring:
	helm uninstall kube-prometheus-stack -n monitoring || echo "Stack not found"
	$(K) delete namespace monitoring || echo "Namespace not found"
	
# ------- Aides -------
status:
	@echo "== Pods ==" && $(K) get pods -o wide
	@echo "== PVC =="  && $(K) get pvc
	@echo "== Services ==" && $(K) get svc
	@echo "== Secrets ==" && $(K) get secrets

pf-master:
	# UI Master sur http://localhost:8080
	$(K) port-forward svc/spark-master-service 8080:8080

pf-driver:
	# UI Driver sur http://localhost:4040
	$(K) port-forward pod/spark-client-0 4040:4040

pf-mongodb:
	# MongoDB shell sur mongodb://localhost:27017
	$(K) port-forward svc/mongodb-service 27017:27017

# ------- MongoDB -------
start-mongodb:
	$(K) apply -f $(MONGODB_DIR)/mongodb_statefulset.yaml
	$(K) wait --for=condition=ready pod -l app=mongodb --timeout=300s
	@echo "MongoDB started! Use 'make pf-mongodb' to access locally."

delete-mongodb:
	-$(K) delete -f $(MONGODB_DIR)/mongodb_statefulset.yaml
	-$(K) delete secret mongodb-secret

# ------- Requêtes MongoDB -------
query-stats:
	@echo "Fetching prediction statistics..."
	$(K) exec -it mongodb-0 -- mongosh \
	  --username $$($(K) get secret mongodb-secret -o jsonpath='{.data.username}' | base64 -d) \
	  --password $$($(K) get secret mongodb-secret -o jsonpath='{.data.password}' | base64 -d) \
	  --authenticationDatabase admin \
	  cybersecurity_db --eval "db.predictions.find().count()"

query-attacks:
	@echo "Fetching attack distribution..."
	$(K) exec -it mongodb-0 -- mongosh \
	  --username $$($(K) get secret mongodb-secret -o jsonpath='{.data.username}' | base64 -d) \
	  --password $$($(K) get secret mongodb-secret -o jsonpath='{.data.password}' | base64 -d) \
	  --authenticationDatabase admin \
	  cybersecurity_db --eval \
	  "db.predictions.aggregate([{$$group: {_id: '$$attack_type', count: {$$sum: 1}}}, {$$sort: {count: -1}}])"


# Supprime ce que tu as créé via apply (propre)
delete-resources:
	-$(K) delete -f $(KAFKA_DIR)/kafka_broker_statefulset.yaml
	-$(K) delete -f $(KAFKA_DIR)/kafka_controller_statefulset.yaml
	-$(K) delete -f $(KAFKA_DIR)/topic_job.yaml
	-$(K) delete -f $(SPARK_DIR)/spark_client_statefulset.yaml
	-$(K) delete -f $(SPARK_DIR)/spark_worker_deployment.yaml
	-$(K) delete -f $(SPARK_DIR)/spark_master_deployment.yaml
	-$(K) delete -f $(PRODUCER_DIR)/producer_deployment.yaml
	-$(K) delete -f $(MONGODB_DIR)/mongodb_statefulset.yaml
	-$(K) delete -f $(FASTAPI_DIR)/fastapi_deployement.yaml
	-$(K) delete -f $(FASTAPI_DIR)/ingress.yaml
	-$(K) delete secret mongodb-secret

# GROS reset (attention: détruit aussi les PVC)
nuke:
	$(K) delete all --all
	$(K) delete pvc --all
	$(K) delete secret mongodb-secret
