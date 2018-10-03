var LogEvent = require('./models/log');

module.exports = function(app) {
    /* API */

    // insert log event
    app.post('/api/log', function(req, res) {

        console.log(req.body);

        // insert new log entry			
        LogEvent.create({
            id: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = Math.random() * 16 | 0,
                    v = c == 'x' ? r : r & 0x3 | 0x8;
                return v.toString(16);
            }),
            entity: req.body.entity,
            operation: req.body.operation,
            description: req.body.description,
            created: new Date()
        }, function(err, itm) {
            console.log(itm);
            if (err)
                res.send(err);

            res.send(itm);
        });

    });

    app.get('/', function(req, res) {
        // default probe
        res.send('OK');
    });
};