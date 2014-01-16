var WebSocketServer = require('ws').Server
  , http = require('http')
  , express = require('express')
  , wsApp = express()
  , wsPort = process.env.PORT || 5000
  , httpApp = express()
  , httpPort = process.env.PORT || 80;

// Set up WebSocket server
wsApp.use(express.static(__dirname + '/'));
//wsApp.use(express.bodyParser());

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
			"id": 21567317,
			"body": "<p>@peterv12 - I really wish I had an answer to the housing crisis; or any other situation where demand exceeds supply. </p> <p>I wish we lived in a world where everyone could have as much of anything, including housing, as they wanted. But we don't; and as long as we don't I think it is not unfair to regard as econonmically illiterate someone like Ms Hanson who thinks that the problem of allocation of scarce resouces can be ignored; or dealt with by selective subsidy of a particular group of people (paid for one assumes by taxing a larger group of not much richer people).</p>",
			"date": "26 February 2013 10:03am",
			"isoDateTime": "2013-02-26T10:03:37Z",
			"status": "visible",
			"webUrl": "http://discussion.theguardian.com/comment-permalink/21567317",
			"apiUrl": "http://discussion.guardianapis.com/discussion-api/comment/21567317",
			"numResponses": 2,
			"numRecommends": 7,
			"isHighlighted": false,
			"responseTo": {
				"displayName": "peterv12",
				"commentApiUrl": "http://discussion.guardianapis.com/discussion-api/comment/21567050",
				"isoDateTime": "2013-02-26T09:50:56Z",
				"date": "26 February 2013 9:50am",
				"commentId": "21567050",
				"commentWebUrl": "http://discussion.theguardian.com/comment-permalink/21567050"
			},
			"userProfile": {
				"userId": "4378739",
				"displayName": "RClayton",
				"webUrl": "http://www.theguardian.com/discussion/user/id/4378739",
				"apiUrl": "http://discussion.guardianapis.com/discussion-api/profile/4378739",
				"avatar": "http://static.guim.co.uk/sys-images/discussion/avatars/2011/10/20/RClayton/de693d9d-bcc0-4843-8cb3-62d2be3da4f2/60x60.png",
				"secureAvatarUrl": "https://static-secure.guim.co.uk/sys-images/discussion/avatars/2011/10/20/RClayton/de693d9d-bcc0-4843-8cb3-62d2be3da4f2/60x60.png",
				"badge": []
			},
			"discussion": {
				"key": "/p/3e3fk",
				"webUrl": "http://www.theguardian.com/lifeandstyle/2013/feb/26/offices-affordable-housing-who-benefits",
				"apiUrl": "http://discussion.guardianapis.com/discussion-api/discussion//p/3e3fk",
				"title": "Turning offices into affordable housing sounds good, but who really benefits?"
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

wsApp.post('/comment', function(req, res) {
	console.log('POST to /comment');
	var type = req.headers['x-amz-sns-message-type'];
	var body = '';
	
	req.on('data', function(data) {
		body += data;
	});
	
	req.on('end', function() {
		// TODO: try/catch
		var postData = JSON.parse(body);
		
		if (type == 'SubscriptionConfirmation') {
			console.log('Amazon SNS confirmation request received');
			console.log(postData);
			var url = postData.SubscribeURL;
		
			http.get(url, function(res2) {
				console.log('Successfully confirmed with ' + url);
			});
		} else {
			console.log('Unhandled Amazon message type: ' + type);
		}

		res.send("OK");
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