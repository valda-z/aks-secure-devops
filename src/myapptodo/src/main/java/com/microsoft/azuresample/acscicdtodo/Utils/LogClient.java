package com.microsoft.azuresample.acscicdtodo.Utils;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import java.util.Map;
import org.springframework.web.client.RestTemplate;
import com.microsoft.azuresample.acscicdtodo.model.LogEvent;;

@Component
public class LogClient {
    static final Logger LOG = LoggerFactory.getLogger(LogClient.class);

	RestTemplate restTemplate = new RestTemplate();

    public static String url;

    public void Log(LogEvent log){
        if(url==null){
            Init();
        }
        restTemplate.postForEntity(url, log, LogEvent.class);
    }

    public void Init(){
        Map<String, String> env = System.getenv();
        url = env.get("LOGREST_URL");

        LOG.info("### INIT of LogClient called.");
    }
}
