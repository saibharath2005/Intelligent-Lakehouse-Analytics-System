import os

os.environ["HADOOP_HOME"] = "C:\\hadoop"
os.environ["hadoop.home.dir"] = "C:\\hadoop"

from pyspark.sql import SparkSession
from delta import configure_spark_with_delta_pip

_spark = None


def get_spark():
    global _spark

    if _spark is None:
        builder = (
            SparkSession.builder
            .appName("InsightLake")
            .master("local[*]")
            .config(
                "spark.sql.extensions",
                "io.delta.sql.DeltaSparkSessionExtension"
            )
            .config(
                "spark.sql.catalog.spark_catalog",
                "org.apache.spark.sql.delta.catalog.DeltaCatalog"
            )
        )

        _spark = configure_spark_with_delta_pip(builder).getOrCreate()

        _spark.sparkContext.setLogLevel("WARN")

    return _spark


def stop_spark():
    global _spark

    if _spark:
        _spark.stop()
        _spark = None