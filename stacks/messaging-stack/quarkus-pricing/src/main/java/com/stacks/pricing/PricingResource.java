package com.stacks.pricing;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.model.UpdateOptions;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.bson.Document;
import org.eclipse.microprofile.reactive.messaging.Incoming;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

@Path("/")
@Produces(MediaType.APPLICATION_JSON)
public class PricingResource {

    @Inject
    MongoClient mongoClient;

    private final AtomicInteger consumed = new AtomicInteger(0);

    @GET
    @Path("/health")
    public Map<String, Object> health() {
        Map<String, Object> m = new HashMap<>();
        m.put("status", "healthy");
        m.put("stack", "messaging");
        m.put("framework", "quarkus");
        m.put("consumed", consumed.get());
        return m;
    }

    @POST
    @Path("/price/{sku}")
    @Consumes(MediaType.APPLICATION_JSON)
    public Map<String, Object> applyPrice(@PathParam("sku") String sku, Map<String, Object> body) {
        double discount = body.containsKey("discount") ? ((Number) body.get("discount")).doubleValue() : 0.0;
        MongoCollection<Document> col = mongoClient.getDatabase("stacks").getCollection("products");
        Document existing = col.find(new Document("sku", sku)).first();
        double base = existing != null && existing.get("price") != null ? existing.getDouble("price") : 19.99;
        double priced = base * (1 - discount);
        col.updateOne(new Document("sku", sku),
                new Document("$set", new Document("price", priced).append("pricedAt", Instant.now().toString())),
                new UpdateOptions().upsert(true));
        System.out.println("[quarkus] price sku=" + sku + " priced=" + priced);
        Map<String, Object> out = new HashMap<>();
        out.put("sku", sku);
        out.put("price", priced);
        return out;
    }

    @GET
    @Path("/price/{sku}")
    public Response getPrice(@PathParam("sku") String sku) {
        Document doc = mongoClient.getDatabase("stacks").getCollection("products")
                .find(new Document("sku", sku)).first();
        if (doc == null) return Response.status(404).build();
        return Response.ok(doc).build();
    }

    @Incoming("catalog-events")
    public void onEvent(String payload) {
        consumed.incrementAndGet();
        System.out.println("[quarkus] rabbit consume: " + payload);
    }
}
