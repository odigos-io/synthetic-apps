package com.example.log4shell;

public class Product {

    private final int id;
    private final String sku;
    private final String title;
    private final String description;
    private final String category;
    private final double price;

    public Product(int id, String sku, String title, String description, String category, double price) {
        this.id = id;
        this.sku = sku;
        this.title = title;
        this.description = description;
        this.category = category;
        this.price = price;
    }

    public int getId() {
        return id;
    }

    public String getSku() {
        return sku;
    }

    public String getTitle() {
        return title;
    }

    public String getDescription() {
        return description;
    }

    public String getCategory() {
        return category;
    }

    public double getPrice() {
        return price;
    }
}
