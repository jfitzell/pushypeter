var WebSocketServer = require('ws').Server
  , http = require('http')
  , express = require('express')
  , wsApp = express()
  , wsPort = 5000
  , httpApp = express()
  , httpPort = process.env.PORT || 80;

// Set up WebSocket server
//wsApp.use(express.static(__dirname + '/'));

var wsServer = http.createServer(wsApp);
wsServer.listen(wsPort);

console.log('Web socket server listening on %d', wsPort);


// Set up plain HTTP server
httpApp.use(express.static(__dirname + '/'));

var httpServer = http.createServer(httpApp);
httpServer.listen(httpPort);

console.log('http server listening on %d', httpPort);




var sockets = new Array();

var wss = new WebSocketServer({server: wsServer});
console.log('websocket wsServer created');
wss.on('connection', function(ws) {
	sockets.push(ws);
	console.log('Pushed new socket. List size: ' + sockets.length);
	
    var id = setInterval(function() {
        ws.send(JSON.stringify(new Date()), function() { });
    }, 10000);

    console.log('websocket connection open');

    ws.on('close', function() {
        console.log('websocket connection close');
        clearInterval(id);
        
        var index = sockets.indexOf(ws);
        if (index > -1) {
        	sockets.splice(index, 1);
        }
        console.log('Removed socket. List size: ' + sockets.length);
    });
});


httpApp.get('/', function(req, res) {
	sockets.map(function(each) {
		each.send(JSON.stringify(req.query.message), function() { });
	});
	
	res.send('Message sent!');
});