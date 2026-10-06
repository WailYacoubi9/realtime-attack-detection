# Guide de Déploiement du Monitoring

## Prérequis

- Cluster Kubernetes opérationnel
- Helm 3.x installé
- kubectl configuré

## Installation

### 1. Déployer la stack Prometheus + Grafana
```bash
make setup-monitoring
```

Cette commande installe :
- Prometheus (scraping des métriques)
- Grafana (visualisation)
- Alertmanager (gestion des alertes)
- Node Exporter (métriques système)

**Temps d'installation** : ~5 minutes

### 2. Déployer les dashboards personnalisés

Les dashboards sont automatiquement chargés via ConfigMaps.

Vérifier le déploiement :
```bash
kubectl get configmap -n monitoring -l grafana_dashboard=1
```

Résultat attendu :
```
hpa-system-dashboard    1      10m
sre-slo-dashboard       1      10m
```

### 3. Accéder à Grafana

#### Depuis le cluster
```bash
kubectl port-forward -n monitoring svc/kube-prometheus-stack-grafana 3000:80
```

Ouvrir : http://localhost:3000

#### Via SSH (depuis Windows/Mac)
```bash
ssh -L 8080:localhost:3000 user@master-node "kubectl port-forward -n monitoring svc/kube-prometheus-stack-grafana 3000:80"
```

Ouvrir : http://localhost:8080

**Credentials** :
- Username: `admin`
- Password: `admin`

## Dashboards Disponibles

### HPA & System Monitoring

Métriques en temps réel :
- Pods Running
- Spark Workers (current replicas)
- Spark Workers CPU utilization
- HPA Scaling History

**Accès** : Dashboards → Rechercher "HPA"

### SRE - SLO Dashboard

Service Level Objectives :
- Kafka Availability (Target: 99.9%)
- Spark Workers count
- CPU Usage (quota monitoring)
- HPA Scaling History
- Under-Replicated Partitions (Kafka health)

**Accès** : Dashboards → Rechercher "SRE"

## Vérification

### Test 1 : Métriques disponibles
```bash
kubectl top nodes
kubectl top pods -n default
```

Si erreur : installer Metrics Server
```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
kubectl patch deployment metrics-server -n kube-system --type='json' -p='[{"op": "add", "path": "/spec/template/spec/containers/0/args/-", "value": "--kubelet-insecure-tls"}]'
```

### Test 2 : Prometheus scrape

Ouvrir Prometheus : http://localhost:9090

Status → Targets → Vérifier que tous sont "UP"

### Test 3 : Dashboards chargés

Dans Grafana : Dashboards → Au moins 2 dashboards "HPA" et "SRE" visibles

## Dépannage

### Dashboard ne s'affiche pas
```bash
# Redémarrer Grafana
kubectl rollout restart deployment kube-prometheus-stack-grafana -n monitoring

# Vérifier les logs
kubectl logs -n monitoring -l app.kubernetes.io/name=grafana
```

### Métriques JMX Kafka manquantes

Vérifier le ServiceMonitor :
```bash
kubectl get servicemonitor -n monitoring kafka-broker-metrics
```

Redémarrer Prometheus si nécessaire :
```bash
kubectl delete pod -n monitoring -l app.kubernetes.io/name=prometheus
```

### Panel "No data"

- Attendre 30-60 secondes (délai de scraping)
- Vérifier la query dans Grafana → Explore
- Vérifier que les pods existent : `kubectl get pods -n default`

## Désinstallation
```bash
make delete-monitoring
```

Supprime tous les composants (Prometheus, Grafana, ConfigMaps, PVC).
