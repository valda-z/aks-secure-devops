FROM kyma/docker-nginx
COPY src/ /var/www
COPY startup.sh /startup.sh
ENTRYPOINT [ "/bin/bash", "/startup.sh" ]