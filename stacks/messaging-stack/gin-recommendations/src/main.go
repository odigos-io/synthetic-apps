package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func mongoURI() string {
	if v := os.Getenv("MONGO_URI"); v != "" {
		return v
	}
	return "mongodb://mongodb.stacks-messaging.svc.cluster.local:27017"
}

func waitMongo(ctx context.Context) *mongo.Database {
	for {
		client, err := mongo.Connect(ctx, options.Client().ApplyURI(mongoURI()))
		if err == nil {
			if err = client.Ping(ctx, nil); err == nil {
				return client.Database("stacks")
			}
		}
		log.Println("waiting for mongodb...")
		time.Sleep(2 * time.Second)
	}
}

func main() {
	db := waitMongo(context.Background())
	fastapi := envOr("FASTAPI_URL", "http://fastapi-products:8080")

	r := gin.Default()
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy", "stack": "messaging", "framework": "gin"})
	})
	r.GET("/recommend/:sku", func(c *gin.Context) {
		sku := c.Param("sku")
		var doc bson.M
		err := db.Collection("products").FindOne(context.Background(), bson.M{"sku": sku}).Decode(&doc)
		if err != nil {
			doc = bson.M{"sku": sku, "name": "unknown", "price": 0}
		}
		rec := gin.H{"sku": sku, "recommended": doc["name"], "score": 0.85}
		log.Printf("[gin] recommend sku=%s", sku)
		http.Get(fastapi + "/products/" + sku)
		c.JSON(http.StatusOK, rec)
	})

	log.Println("gin-recommendations on :8080")
	r.Run(":8080")
}

func envOr(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}
