# Dashboards Grafana

## Vue d'ensemble

Deux dashboards personnalisés pour le monitoring du système de détection de menaces distribué.

---

## 1. HPA & System Monitoring

**Objectif** : Monitoring en temps réel de l'autoscaling et des ressources système.

### Métriques

| Panel | Type | Métrique | Interprétation |
|-------|------|----------|----------------|
| Pods Running | Stat | `count(kube_pod_status_phase{namespace="default",phase="Running"})` | Nombre total de pods actifs |
| Spark Workers | Stat | `kube_horizontalpodautoscaler_status_current_replicas{horizontalpodautoscaler="spark-worker-hpa"}` | Replicas actuels (min: 1, max: 10) |
| Spark Workers CPU | Graph | `rate(container_cpu_usage_seconds_total{pod=~"spark-worker.*"}[5m]) * 100` | Utilisation CPU moyenne (seuil HPA: 70%) |
| HPA Scaling History | Graph | `kube_horizontalpodautoscaler_status_current_replicas` vs `desired_replicas` | Historique des événements de scaling |

**Période recommandée** : Last 30 minutes (auto-refresh: 10s)

---

## 2. SRE - SLO Dashboard

**Objectif** : Suivi des Service Level Objectives.

### SLO Définis

| Métrique | Target | Query PromQL |
|----------|--------|--------------|
| **Availability** | ≥ 99.9% | `(count(kube_pod_status_phase{namespace="default",pod=~"kafka-broker.*",phase="Running"}) / 3) * 100` |
| **CPU Quota** | < 90% | `(sum(rate(container_cpu_usage_seconds_total{namespace="default",container!="",container!="POD"}[5m])) / 12) * 100` |
| **Under-Replicated Partitions** | 0 | `sum(kafka_under_replicated_partitions)` |

### Panels

**1. Availability**
- Type: Gauge
- Seuils: Rouge (<99%), Jaune (99-99.9%), Vert (≥99.9%)
- Mesure: Disponibilité des brokers Kafka (3 replicas)

**2. Spark Workers**
- Type: Stat
- Valeur: Nombre de workers actifs

**3. CPU Usage**
- Type: Gauge
- Quota: 12 vCPUs alloués
- Seuils: Vert (0-70%), Jaune (70-90%), Rouge (>90%)

**4. HPA Scaling History**
- Type: Time series
- Courbes: Current vs Desired replicas
- Permet de visualiser les événements de scaling

**5. Under-Replicated Partitions**
- Type: Stat
- Valeur attendue: 0 (vert)
- Alerte si > 0 (rouge) : risque de perte de données Kafka

**Période recommandée** : Last 6 hours

---

## Tests de Validation

### Test 1 : Vérifier l'availability metric
```bash
kubectl get pods -l app=kafka-broker
```

Résultat attendu : 3/3 Running → Dashboard affiche 100%

### Test 2 : Tester la réactivité du monitoring
```bash
# Scale down Kafka
kubectl scale statefulset kafka-broker --replicas=2

# Observer dans Grafana : Availability passe à 66.7% (rouge)
# Attendre ~30 secondes (délai scrape Prometheus)

# Scale up
kubectl scale statefulset kafka-broker --replicas=3

# Observer : Retour à 100% (vert)
```

### Test 3 : Vérifier les métriques JMX
```bash
kubectl port-forward kafka-broker-0 7071:7071 &
curl localhost:7071/metrics | grep kafka_under_replicated_partitions
```

Résultat attendu : `kafka_under_replicated_partitions 0.0`

---

## Queries PromQL Utiles

### Debugging
```promql
# Pods par namespace
count(kube_pod_status_phase{phase="Running"}) by (namespace)

# Top 5 CPU consumers
topk(5, sum(rate(container_cpu_usage_seconds_total{namespace="default"}[5m])) by (pod))

# Memory usage par pod
sum(container_memory_working_set_bytes{namespace="default"}) by (pod) / 1024 / 1024
```

### Alerting

Règles configurées dans `prometheus-rules-advanced.yaml` :

- **SLOAvailabilityViolation** : Availability < 99.9% pendant 2 minutes
- **KafkaUnderReplicatedPartitions** : Partitions sous-répliquées détectées
- **HPAMaxReplicasReached** : HPA atteint la limite max pendant 5 minutes
- **HighCPUThrottling** : CPU throttling détecté sur Spark workers

---

## Maintenance

### Recharger un dashboard
```bash
# Méthode 1 : Via ConfigMap
kubectl create configmap <dashboard-name> \
  --from-file=<file>.json \
  --namespace=monitoring \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl label configmap <dashboard-name> -n monitoring grafana_dashboard="1" --overwrite

# Méthode 2 : Restart Grafana
kubectl rollout restart deployment kube-prometheus-stack-grafana -n monitoring
```

### Vérifier les ConfigMaps
```bash
kubectl get configmap -n monitoring -l grafana_dashboard=1
```

### Supprimer un dashboard
```bash
kubectl delete configmap <dashboard-name> -n monitoring
```

---

**Version** : 1.0  
**Dernière mise à jour** : 2026-01-25
