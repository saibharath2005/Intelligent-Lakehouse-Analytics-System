from spark.session import get_spark


def analyze_dataset(project_id: int, dataset: str, query: str):

    spark = get_spark()

    path = f"data_lake/project_{project_id}/{dataset.split(".")[0]}"

    df = spark.read.format("delta").load(path)

    df.createOrReplaceTempView("data")

    try:
        result_df = spark.sql(query)
        result = [row.asDict() for row in result_df.limit(1000).collect()]
        return result
    except Exception as e:
        return {"error": str(e)}


def get_dataset_schema(project_id: int, dataset: str):

    spark = get_spark()

    path = f"data_lake/project_{project_id}/{dataset.split(".")[0]}"
    df = spark.read.format("delta").load(path)

    schema_info = []
    for field in df.schema.fields:
        schema_info.append({
            "name": field.name,
            "type": str(field.dataType)
        })

    return schema_info