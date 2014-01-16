var WebSocketServer = require('ws').Server
  , http = require('http')
  , express = require('express')
  , wsApp = express()
  , wsPort = process.env.PORT || 5000
  , httpApp = express()
  , httpPort = process.env.PORT || 80;

// Set up WebSocket server
wsApp.use(express.static(__dirname + '/'));

var wsServer = http.createServer(wsApp);
wsServer.listen(wsPort);

console.log('Web socket server listening on %d', wsPort);


// Set up plain HTTP server
// httpApp.use(express.static(__dirname + '/'));
// 
// var httpServer = http.createServer(httpApp);
// httpServer.listen(httpPort);
// 
// console.log('http server listening on %d', httpPort);

function Ping() {
	return {
		type: 'ping',
		date: new Date()
	};
}

function DirectReply() {
	return {
		type: 'directreply',
		comment: {
			"id": 21566071,
			"body": "<p>Stinks... good word.</p>",
			"date": "26 February 2013 9:03am",
			"isoDateTime": "2013-02-26T09:03:32Z",
			"status": "visible",
			"webUrl": "http://discussion.theguardian.com/comment-permalink/21566071",
			"apiUrl": "http://discussion.guardianapis.com/discussion-api/comment/21566071",
			"numRecommends": 18,
			"isHighlighted": false,
			"userProfile": {
				"userId": "3774756",
				"displayName": "arborfield",
				"webUrl": "http://www.theguardian.com/discussion/user/id/3774756",
				"apiUrl": "http://discussion.guardianapis.com/discussion-api/profile/3774756",
				"avatar": "http://static.guim.co.uk/sys-images/Guardian/Pix/site_furniture/2010/09/01/no-user-image.gif",
				"secureAvatarUrl": "https://static-secure.guim.co.uk/sys-images/Guardian/Pix/site_furniture/2010/09/01/no-user-image.gif",
				"badge": []
			}
		}
	};
}

function Message(text) {
	return {
		type: 'message',
		text: text
	};
}

var sockets = new Array();

var wss = new WebSocketServer({server: wsServer});
console.log('websocket wsServer created');
wss.on('connection', function(ws) {
	sockets.push(ws);
	console.log('Pushed new socket. List size: ' + sockets.length);
	
    var id = setInterval(function() {
        ws.send(JSON.stringify(new Ping()), function() { });
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

wsApp.get('/comment', function(req, res) {
	sockets.map(function(each) {
		each.send(JSON.stringify(new DirectReply()), function() { });
	});
	
	res.send('Notification sent!');
});

wsApp.get('/send', function(req, res) {
	sockets.map(function(each) {
		each.send(JSON.stringify(new Message(req.query.message)), function() { });
	});
	
	res.send('Message sent!');
});