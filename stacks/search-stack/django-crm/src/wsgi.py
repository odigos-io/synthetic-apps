import os
import django
from django.conf import settings
from django.core.wsgi import get_wsgi_application
from django.http import JsonResponse
from django.urls import path
from django.db import connection, models

settings.configure(
    DEBUG=False,
    SECRET_KEY="stacks-demo",
    ROOT_URLCONF=__name__,
    DATABASES={
        "default": {
            "ENGINE": "django.db.backends.mysql",
            "NAME": os.environ.get("MYSQL_DATABASE", "stacks"),
            "USER": os.environ.get("MYSQL_USER", "app"),
            "PASSWORD": os.environ.get("MYSQL_PASSWORD", "app"),
            "HOST": os.environ.get("MYSQL_HOST", "mysql"),
            "PORT": os.environ.get("MYSQL_DB_PORT", "3306"),
        }
    },
    INSTALLED_APPS=["django.contrib.contenttypes"],
    USE_TZ=True,
)
django.setup()


class Customer(models.Model):
    customer_id = models.CharField(max_length=64, primary_key=True)
    name = models.CharField(max_length=128)
    email = models.EmailField(max_length=128)

    class Meta:
        app_label = "crm"


def health(_):
    with connection.cursor() as c:
        c.execute("SELECT 1")
    return JsonResponse({"status": "healthy", "stack": "search", "framework": "django"})


def get_customer(_, customer_id):
    Customer.objects.using("default")
    with connection.cursor() as c:
        c.execute(
            "CREATE TABLE IF NOT EXISTS crm_customer (customer_id VARCHAR(64) PRIMARY KEY, name VARCHAR(128), email VARCHAR(128))"
        )
        c.execute(
            "INSERT IGNORE INTO crm_customer VALUES (%s, %s, %s)",
            [customer_id, "Alice Demo", f"{customer_id}@example.com"],
        )
        c.execute("SELECT customer_id, name, email FROM crm_customer WHERE customer_id=%s", [customer_id])
        row = c.fetchone()
    if not row:
        return JsonResponse({"error": "not found"}, status=404)
    return JsonResponse({"customerId": row[0], "name": row[1], "email": row[2]})


urlpatterns = [
    path("health", health),
    path("customers/<str:customer_id>", get_customer),
]

application = get_wsgi_application()
