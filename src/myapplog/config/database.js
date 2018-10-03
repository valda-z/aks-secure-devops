var mongourl = "mongodb://" +
    process.env.MONGO_DB + ":" +
    encodeURIComponent(process.env.MONGO_PWD) + "@" +
    process.env.MONGO_DB +
    ".documents.azure.com:10255/logs?ssl=true&replicaSet=globaldb";

module.exports = {
    // mongo database connection url
    url: mongourl
};