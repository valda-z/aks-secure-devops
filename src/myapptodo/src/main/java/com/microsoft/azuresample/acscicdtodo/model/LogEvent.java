package com.microsoft.azuresample.acscicdtodo.model;

import java.util.Date;

import com.fasterxml.jackson.annotation.JsonProperty;

public class LogEvent {
    private String id;
    private String entity;
    private String operation;
    private String description;
    private Date created;
    
    public LogEvent(){

    }

    public LogEvent(String id, String entity, String operation, String description, Date created){
        this.setId(id);
        this.setEntity(entity);
        this.setOperation(operation);
        this.setDescription(description);
        this.setCreated(created);
    }

    public LogEvent(String entity, String operation, String description){
        this.setEntity(entity);
        this.setOperation(operation);
        this.setDescription(description);
    }

    @JsonProperty("id")
    public String getId() {
        return id;
    }

    @JsonProperty("id")
    public void setId(String id) {
        this.id = id;
    }

    @JsonProperty("entity")
    public String getEntity() {
        return entity;
    }

    @JsonProperty("entity")
    public void setEntity(String entity) {
        this.entity = entity;
    }

    @JsonProperty("operation")
    public String getOperation() {
        return operation;
    }

    @JsonProperty("operation")
    public void setOperation(String operation) {
        this.operation = operation;
    }

    @JsonProperty("description")
    public String getDescription() {
        return description;
    }

    @JsonProperty("description")
    public void setDescription(String description) {
        this.description = description;
    }

    @JsonProperty("created")
    public Date getCreated() {
        return created;
    }

    @JsonProperty("created")
    public void setCreated(Date created) {
        this.created = created;
    }

}