# Secure DevOps and Secure AKS cluster

## Abstract

Aim of this repo is to prepare environment and process for secure development and secure operation of solution in DevOps environment for agile teams. Solution is build on top of AKS (kubernetes cluster) with istio service mesh extension and supporting container solution for specific Azure services (like KeyVault).

Lets try to deliver rules and boundaries for different roles in DevOps and organization operation teams.

Solution uses for demonstration set of microservices in different languages (AngularJS frontend in nginx, Java spring-boot, NodeJS) and utilizes different Azure services (AKS, Azure Container Registry, Azure Database for PostgreSQL, CosmosDB - with MongoDB API, KeyVault, Application Insights)

### Solution architecture

Picture describes architecture design of our microservice solution and also defines communication flows for components.

### Security constrains

* AKS is managed by AAD accounts (in cluster we can setup roles and grant access to users or security group)
* AKS installation and security setup is done by "admin" user, this type of authentication is later on not used for day-to-day tasks
* ACR (Azure Container Registry) also uses AAD authentication for users
* ACR authenticates AKS by service principal which is generated during AKS installation
* istio is used to setup mTLS communication in service mesh
* istio is used to control which services can communicate to which endpoints
* istio external service definition is used to control which services are used outside of cluster

### RBAC / authentication / Roles definition

For RBAC and authentication we will use kubernetes RBAC and direct connection for AKS to ADD where we can define users/groups and connect them with RBAC definitions for AKS.

* **AKS administrator** (the one who is able configure all AKS assets, setup istio rules for all namespaces)
* **Solution level** (namespace level)
    * **Security** (setting up credentials for DB and security rules for istio)
    * **Network** (define ingress/egress rules and routing)
    * **Deployment** (deploy solution)
    * **Operation** (see logs and component health - read permission to objects)

## Prerequisites 

Installed tools:
* kubectl - https://kubernetes.io/docs/tasks/tools/install-kubectl/
* helm - https://docs.helm.sh/using_helm/#installing-helm
* istio 1.0.2 - https://istio.io/docs/setup/kubernetes/download-release/
* az CLI - https://docs.microsoft.com/en-us/cli/azure/install-azure-cli?view=azure-cli-latest

## Install necessary Azure Resources

All steps described in next captions expect that you have authenticated `az` CLI command line. For example you can use Azure Cloud Shell (https://shell.azure.com).

### Create Resource Group

Create resource group in your favorite region (check if AKS can be deployed there).

```bash
az group create --location northeurope --name AKSSEC
```

### Prepare AAD applications for AKS AAD authentication

Please follow these links and create Server and Client AAD applications. Collect necessary details, it means:
* Server APP ID
* Server App Secret
* Client App ID
* Tenant ID

https://docs.microsoft.com/en-us/azure/aks/aad-integration#create-server-application

https://docs.microsoft.com/en-us/azure/aks/aad-integration#create-client-application

### Deploy AKS cluster

Deploy cluster with RBAC and AAD enabled.

```bash
az aks create --resource-group AKSSEC --name akssec \
  --no-ssh-key --kubernetes-version 1.11.2 --node-count 2 --node-vm-size Standard_DS1_v2 \
  --aad-server-app-id XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXX   \
  --aad-server-app-secret '#############################'  \
  --aad-client-app-id XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXX \
  --aad-tenant-id XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXX  \
  --location northeurope
```

After successful deployment we will download kubernetes config file with "admin" credentials to finalize deployment and configuration. For day-to-day work will be used kubernetes config without admin private key and cluster will be authenticated via AAD authentication.

```bash
az aks get-credentials --name akssec --resource-group AKSSEC --admin
```

### Deploy Azure Container Registry (ACR)

Deploy container registry, please be aware that you have to provide unique name of ACR (int description you can see name `valdaakssec001` which has to be replaced with your registry name).

```bash
ACR_RESOURCE_GROUP=AKSSEC
ACR_NAME=valdaakssec001

az acr create --name $ACR_NAME --resource-group $ACR_RESOURCE_GROUP --sku Standard --location northeurope
```

Grant access for AKS cluster to ACR registry with read permission.

```bash
AKS_RESOURCE_GROUP=AKSSEC
AKS_CLUSTER_NAME=akssec
ACR_RESOURCE_GROUP=AKSSEC
ACR_NAME=valdaakssec001

# Get the id of the service principal configured for AKS
CLIENT_ID=$(az aks show --resource-group $AKS_RESOURCE_GROUP --name $AKS_CLUSTER_NAME --query "servicePrincipalProfile.clientId" --output tsv)

# Get the ACR registry resource id
ACR_ID=$(az acr show --name $ACR_NAME --resource-group $ACR_RESOURCE_GROUP --query "id" --output tsv)

# Create role assignment
az role assignment create --assignee $CLIENT_ID --role Reader --scope $ACR_ID

# Get ACR_URL for future use with docker-compose and build
export ACR_URL=$(az acr show --name $ACR_NAME --resource-group $ACR_RESOURCE_GROUP --query "loginServer" --output tsv)
echo $ACR_URL
```

### Deploy Azure Database for PostgreSQL

First step is to create PostgreSQL database. Be aware that name of PostgreSQL server has to be unique, you have to change name `valdaakspostgresql001` to some unique name fits to your setup.

```bash
# create PostgreSQL server in Azure
az postgres server create --resource-group AKSSEC \
  --name valdaakspostgresql001  --location northeurope \
  --admin-user myadmin --admin-password VerySecurePassword123... \
  --sku-name B_Gen5_1 --version 9.6

# Get PostgreSQL FQDN (we will need in later on for configuration)
POSTGRES_FQDN=$(az postgres server show --resource-group AKSSEC --name valdaakspostgresql001 --query "fullyQualifiedDomainName" --output tsv)
echo $POSTGRES_FQDN
```
After successful deployment we will create regular database `todo` for our microservice. 

```bash
# create PostgreSQL database in Azure
az postgres db create --resource-group AKSSEC \
  --server-name valdaakspostgresql001   \
  --name todo

# enable access for Azure resources
az postgres server firewall-rule create \
  --server-name valdaakspostgresql001 \
  --resource-group AKSSEC \
  --name "AllowAllWindowsAzureIps" --start-ip-address "0.0.0.0" --end-ip-address "0.0.0.0"
```

*Note: In real scenario please create also non-privileged DB user for access your databases on PostgreSQL server! Also we can use Service Endpoint to establish connection from VNET to PostgreSQL for better security.*

### Deploy CosmosDB with Mongo API

Now lets create CosmosDB instance with MongoDB API for our solution. Because database uses global FQDN please replace name `valdaaksmongodb001` by name which fits your needs.

```bash
# Create CosmosDB instance
az cosmosdb create --name valdaaksmongodb001 --kind MongoDB --resource-group AKSSEC
```

### Deploy Application insights

Application insights are used for collecting application logs, diagnostic and traces.

```bash
# Create Application Insights
az resource create -g AKSSEC -n akssecappinsights001 --resource-type microsoft.insights/components --api-version '2015-05-01' --is-full-object --properties '{
  "location": "northeurope",
  "tags": {},
  "kind": "web",
  "properties": {
    "Application_Type": "web",
    "Flow_Type": "Bluefield",
    "Request_Source": "rest"
  }
}'

# Collect Instrumentation key - we will need it later on
APPINSIGHT_KEY=$(APPINSIGHT_KEY= az resource show -g AKSSEC -n akssecappinsights001 --resource-type microsoft.insights/components --query "properties.InstrumentationKey" -o tsv)
echo $APPINSIGHT_KEY
```

### Create KeyVault for storing security assets

In this step we will create KeyVault for storing keys and secrets, KeyVault name has to be unique in Azure, please change name `valdaakskeyvault001` which will fit your needs.

```bash
# create keyvault
az keyvault create -n valdaakskeyvault001 -g AKSSEC

# setup access to AKS
CLIENT_ID=$(az aks show --resource-group AKSSEC --name akssec --query "servicePrincipalProfile.clientId" --output tsv)
az keyvault set-policy -n valdaakskeyvault001 \
  --key-permissions get list decrypt \
  --secret-permissions get list \
  --certificate-permissions get list \
  --spn $CLIENT_ID

# create on testing secret
az keyvault secret set --vault-name 'valdaakskeyvault001' --name 'TEST' --value 'TEST-PWD'
```

## Initialize kubernetes cluster and helm

Now we can download kubernetes credentials for admin and install helm.

```bash
# download kubernetes config for admin
az aks browse --resource-group AKSSEC --name akssec --admin

# patch kubernetes configuration to be able to access control plane
kubectl create clusterrolebinding kubernetes-dashboard \
  -n kube-system --clusterrole=cluster-admin \
  --serviceaccount=kube-system:kubernetes-dashboard

# Create a service account for Helm and grant the cluster admin role.
cat <<EOF | kubectl create -f -
apiVersion: v1
kind: ServiceAccount
metadata:
  name: tiller
  namespace: kube-system
---
apiVersion: rbac.authorization.k8s.io/v1beta1
kind: ClusterRoleBinding
metadata:
  name: tiller
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: cluster-admin
subjects:
- kind: ServiceAccount
  name: tiller
  namespace: kube-system
EOF

# initialize helm
helm init --service-account tiller --upgrade

# after while check if helm is installed in cluster
helm version
```

## Build images and push to Azure Container Registry

Images for solution are build via one docker-compose file, in real situation there will be some separated CI/CD pipeline for each microservice to achieve individual lifecycle.

### Login to ACR with AAD (user)

You have to change name `valdaakssec001` to name of registry which you created.

```bash
# name of registry
export ACR_NAME=valdaakssec001

# login to registry
az acr login --name $ACR_NAME
```

### Build and push images

First step is to clone sources from github to your machine `git clone git@github.com:valda-z/aks-secure-devops.git`.
Than enter directory with sources, sources are located in directory `./src`.

Please check that you have initialized variable `ACR_URL` with full name of your ACR registry (see description above how to read ACR_URL) or you can set variable and get value from Azure portal.

```bash
# Get ACR_URL for future use with docker-compose and build
export ACR_URL=$(az acr show --name $ACR_NAME --resource-group AKSSEC --query "loginServer" --output tsv)
echo $ACR_URL

# enter to src directory
cd src

# build images and push to registry
docker-compose build
docker-compose push
```
## Test current status of deployment (now unsecured)

### Create namespace for our test

```bash
kubectl create namespace mytest
```

### Install nging ingress controller

This command will create nginx ingress controler which will be used for communication from external world via public IP.

```bash
# install nginx
helm install --name default-ingress stable/nginx-ingress --namespace mytest

# wait for deployment
kubectl get svc --namespace mytest

```

Command `kubectl get svc --namespace mytest` has to return External IP for ingress controller, in my case it is `23.101.56.104`, we will need this address in future for configuring DNS rules.
In real world you will put this IP to your DNS registry to point some DNS name to this address.

```text
NAME                                            TYPE           CLUSTER-IP     EXTERNAL-IP     PORT(S)                      AGE
default-ingress-nginx-ingress-controller        LoadBalancer   10.0.89.222    23.101.56.104   80:31661/TCP,443:32461/TCP   2m
default-ingress-nginx-ingress-default-backend   ClusterIP      10.0.217.153   <none>          80/TCP                       2m
```

### Deploy our microservices via helm to namespace `mytest`

It will be deployed with release name `myrelease`, this name is also part of secrets definitions.

#### Create secrets - it will contain connection string information

```bash
# Collect Instrumentation key
APPINSIGHT_KEY=$(APPINSIGHT_KEY= az resource show -g AKSSEC -n akssecappinsights001 --resource-type microsoft.insights/components --query "properties.InstrumentationKey" -o tsv)
echo $APPINSIGHT_KEY

# create secrets for myappspa
kubectl create secret generic myreleasespa-myappspa \
  --from-literal=appinsightskey="$APPINSIGHT_KEY" \
  --namespace mytest

# create secrets for myapptodo
POSTGRESQL_NAME=valdaakspostgresql001
POSTGRESQL_USER=myadmin
POSTGRESQL_PASSWORD=VerySecurePassword123...
POSTGRESQL_URL="jdbc:postgresql://${POSTGRESQL_NAME}.postgres.database.azure.com:5432/todo?user=${POSTGRESQL_USER}@${POSTGRESQL_NAME}&password=${POSTGRESQL_PASSWORD}&ssl=true"
kubectl create secret generic myreleasetodo-myapptodo \
  --from-literal=appinsightskey="$APPINSIGHT_KEY" \
  --from-literal=postgresqlurl="$POSTGRESQL_URL" \
  --namespace mytest

# create secrets for myapplog
MONGO_DB="valdaaksmongodb001"
MONGO_PWD=$(az cosmosdb list-keys --name $MONGO_DB --resource-group AKSSEC  --query "primaryMasterKey" --output tsv)
kubectl create secret generic myreleaselog-myapplog \
  --from-literal=appinsightskey="$APPINSIGHT_KEY" \
  --from-literal=mongodb="$MONGO_DB" \
  --from-literal=mongopwd="$MONGO_PWD" \
  --namespace mytest
```

#### Deploy micro-services

Lets use DNS name created dynamically from IP Address - in my case `23.101.56.104.xip.io`.

##### myappspa

Microservice with frontend (html5/angularjs/nginx) which is exposed to internet via nginx ingress controller.
Change ACR name `valdaakssec001` to your name of ACR.

```bash
# run helm installation
helm upgrade --install myreleasespa myappspa --set-string image.repository='valdaakssec001.azurecr.io/myappspa',image.tag='1',ingress.host='23.101.56.104.xip.io' --namespace='mytest'
```

##### myapplog

Microservice with backend (nodejs/mongo) which is exposed only internaly to cluster.
Change ACR name `valdaakssec001` to your name of ACR.

```bash
# run helm installation
helm upgrade --install myreleaselog myapplog --set-string image.repository='valdaakssec001.azurecr.io/myapplog',image.tag='1' --namespace='mytest'
```

##### myapptodo

Microservice with backend (java/postgres) which is exposed to internet via nginx ingress controller to path /api/todo.
Change ACR name `valdaakssec001` to your name of ACR.

```bash
# run helm installation
helm upgrade --install myreleasetodo myapptodo --set-string image.repository='valdaakssec001.azurecr.io/myapptodo',image.tag='1',logservice.url='http://myreleaselog-myapplog:8080/api/log',ingress.host='23.101.56.104.xip.io' --namespace='mytest'
```

### Access kubernetes by admin account

Now we can download kubernetes credentials for admin and try to access cluster control plane.

```bash
# download kubernetes config for admin
az aks browse --resource-group AKSSEC --name akssec --admin

# run proxy
kubectl proxy
```

Now we can access kubernetes control plane on address http://localhost:8001/api/v1/namespaces/kube-system/services/kubernetes-dashboard/proxy/

### Test our application deployment

## Setup istio

## Setup roles and RBACS

## Check access to kubeproxy

### Access kubernetes by AAD account

## Appendix

Source codes of all applications are stored in folder /src, whole solution is build by docker-compose.

Also integration with CI/CD pipeline is not in scope of this document, because preparation of AKS cluster (include RBAC, istio configuration) has to be done first. Microservice deployment is done from command line by helm tool, helm can be integrated easily with any CI/CD pipeline.

