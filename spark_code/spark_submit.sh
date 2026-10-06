export SPARK_LOG_LEVEL=WARN

/opt/spark/bin/spark-submit \
  --master spark://spark-master-service:7077 \
  --executor-memory 512m \
  --executor-cores 1 \
  --total-executor-cores 5 \
  --conf spark.pyspark.python=python3 \
  --conf spark.pyspark.driver.python=python3 \
  --conf spark.driver.host=spark-client-0.spark-client-service.default.svc.cluster.local \
  --conf spark.driver.port=8081 \
  --deploy-mode client \
  --packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.5.0 \
  --name "testApp" \
  spark_job.py
