var builder = WebApplication.CreateBuilder(args);

var djangoUrl = Environment.GetEnvironmentVariable("DJANGO_URL") ?? "http://django-crm.stacks-search.svc.cluster.local:8080";
var indexerUrl = Environment.GetEnvironmentVariable("INDEXER_URL") ?? "http://go-indexer.stacks-search.svc.cluster.local:8080";
var phpUrl = Environment.GetEnvironmentVariable("PHP_URL") ?? "http://php-shipping.stacks-search.svc.cluster.local:8080";
var cacheUrl = Environment.GetEnvironmentVariable("CACHE_URL") ?? "http://nodejs-cache.stacks-search.svc.cluster.local:8080";

var app = builder.Build();

app.MapGet("/health", () => Results.Ok(new { status = "healthy", stack = "search", gateway = "dotnet" }));

app.MapGet("/transactions", () => Results.Ok(new
{
    transactions = new[]
    {
        new { name = "customer-lookup", path = "/transactions/customer-lookup", order = "django/mysql → go/es → memcached" },
        new { name = "index-document", path = "/transactions/index-document", order = "go/es → django → memcached" },
        new { name = "ship-order", path = "/transactions/ship-order", order = "php/mysql → dotnet → es" },
    }
}));

async Task<List<object>> CallDownstream(HttpContext ctx, string name, Func<Task<List<object>>> fn)
{
    ctx.Response.Headers["X-Transaction-Name"] = name;
    return await fn();
}

app.MapPost("/transactions/customer-lookup", async (CustomerReq req, HttpContext ctx) =>
{
    var http = new HttpClient();
    var steps = new List<object>();
    var customerId = req.CustomerId ?? req.Key ?? "cust-1";
    try
    {
        var d = await http.GetAsync($"{djangoUrl}/customers/{customerId}");
        steps.Add(new { service = "django-crm", status = (int)d.StatusCode });
        var idx = await http.PostAsync($"{indexerUrl}/index",
            new StringContent(System.Text.Json.JsonSerializer.Serialize(new { id = customerId, type = "customer" }),
                System.Text.Encoding.UTF8, "application/json"));
        steps.Add(new { service = "go-indexer", status = (int)idx.StatusCode });
        var c = await http.GetAsync($"{cacheUrl}/cache/{customerId}");
        steps.Add(new { service = "nodejs-cache", status = (int)c.StatusCode });
        ctx.Response.Headers["X-Transaction-Name"] = "customer-lookup";
        return Results.Ok(new { transaction = "customer-lookup", customerId, steps });
    }
    catch (Exception ex)
    {
        return Results.Json(new { transaction = "customer-lookup", error = ex.Message, steps }, statusCode: 500);
    }
});

app.MapPost("/transactions/index-document", async (IndexReq req, HttpContext ctx) =>
{
    var http = new HttpClient();
    var steps = new List<object>();
    var id = req.Id ?? req.Key ?? "doc-1";
    try
    {
        var idx = await http.PostAsync($"{indexerUrl}/index",
            new StringContent(System.Text.Json.JsonSerializer.Serialize(new { id, body = req.Body ?? "sample" }),
                System.Text.Encoding.UTF8, "application/json"));
        steps.Add(new { service = "go-indexer", status = (int)idx.StatusCode });
        var d = await http.GetAsync($"{djangoUrl}/customers/{id}");
        steps.Add(new { service = "django-crm", status = (int)d.StatusCode });
        var c = await http.PostAsync($"{cacheUrl}/cache/{id}",
            new StringContent(System.Text.Json.JsonSerializer.Serialize(new { value = req.Body }),
                System.Text.Encoding.UTF8, "application/json"));
        steps.Add(new { service = "nodejs-cache", status = (int)c.StatusCode });
        ctx.Response.Headers["X-Transaction-Name"] = "index-document";
        return Results.Ok(new { transaction = "index-document", id, steps });
    }
    catch (Exception ex)
    {
        return Results.Json(new { transaction = "index-document", error = ex.Message, steps }, statusCode: 500);
    }
});

app.MapPost("/transactions/ship-order", async (ShipReq req, HttpContext ctx) =>
{
    var http = new HttpClient();
    var steps = new List<object>();
    var orderId = req.OrderId ?? req.Key ?? "ord-1";
    try
    {
        var p = await http.PostAsync($"{phpUrl}/ship",
            new StringContent(System.Text.Json.JsonSerializer.Serialize(new { orderId, customerId = req.CustomerId ?? "cust-1" }),
                System.Text.Encoding.UTF8, "application/json"));
        steps.Add(new { service = "php-shipping", status = (int)p.StatusCode });
        var s = await http.GetAsync($"{indexerUrl}/search?q={orderId}");
        steps.Add(new { service = "go-indexer", status = (int)s.StatusCode });
        ctx.Response.Headers["X-Transaction-Name"] = "ship-order";
        return Results.Ok(new { transaction = "ship-order", orderId, steps });
    }
    catch (Exception ex)
    {
        return Results.Json(new { transaction = "ship-order", error = ex.Message, steps }, statusCode: 500);
    }
});

app.Run("http://0.0.0.0:8080");

record CustomerReq(string? CustomerId, string? Key);
record IndexReq(string? Id, string? Key, string? Body);
record ShipReq(string? OrderId, string? Key, string? CustomerId);
