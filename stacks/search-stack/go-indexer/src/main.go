package main

import (
	"bytes"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
)

func esURL() string {
	if v := os.Getenv("ELASTICSEARCH_URL"); v != "" {
		return v
	}
	return "http://elasticsearch.stacks-search.svc.cluster.local:9200"
}

func waitES() {
	for {
		resp, err := http.Get(esURL())
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode < 500 {
				return
			}
		}
		log.Println("waiting for elasticsearch...")
		time.Sleep(3 * time.Second)
	}
}

func ensureIndex() {
	body := `{"mappings":{"properties":{"id":{"type":"keyword"},"body":{"type":"text"}}}}`
	req, _ := http.NewRequest(http.MethodPut, esURL()+"/stacks-docs", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	http.DefaultClient.Do(req)
}

func main() {
	waitES()
	ensureIndex()

	e := echo.New()
	e.GET("/health", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{"status": "healthy", "stack": "search", "framework": "echo"})
	})
	e.POST("/index", func(c echo.Context) error {
		var doc map[string]interface{}
		if err := c.Bind(&doc); err != nil {
			return echo.NewHTTPError(400, err.Error())
		}
		id, _ := doc["id"].(string)
		if id == "" {
			id = "unknown"
		}
		payload, _ := json.Marshal(doc)
		url := esURL() + "/stacks-docs/_doc/" + id
		req, _ := http.NewRequest(http.MethodPut, url, bytes.NewReader(payload))
		req.Header.Set("Content-Type", "application/json")
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return echo.NewHTTPError(502, err.Error())
		}
		defer resp.Body.Close()
		b, _ := io.ReadAll(resp.Body)
		log.Printf("[indexer] indexed id=%s status=%d", id, resp.StatusCode)
		return c.JSONBlob(resp.StatusCode, b)
	})
	e.GET("/search", func(c echo.Context) error {
		q := c.QueryParam("q")
		query := map[string]interface{}{
			"query": map[string]interface{}{"match": map[string]interface{}{"body": q}},
		}
		payload, _ := json.Marshal(query)
		resp, err := http.Post(esURL()+"/stacks-docs/_search", "application/json", bytes.NewReader(payload))
		if err != nil {
			return echo.NewHTTPError(502, err.Error())
		}
		defer resp.Body.Close()
		b, _ := io.ReadAll(resp.Body)
		return c.JSONBlob(resp.StatusCode, b)
	})

	log.Println("go-indexer (Echo) on :8080")
	e.Logger.Fatal(e.Start(":8080"))
}
