var WebSocketServer = require('ws').Server
  , http = require('http')
  , https = require('https')
  , express = require('express')
  , app = express()
  , wsPort = process.env.PORT || 5000;

const discussionAPIBase = 'http://discussion.code.dev-guardianapis.com/discussion-api/';
const contentAPIBase = '***REMOVED***';

// Set up WebSocket server
app.use(express.static(__dirname + '/'));
//app.use(express.bodyParser());

var server = http.createServer(app);
server.listen(wsPort);

console.log('Server listening on %d', wsPort);

const exampleContentId = 'commentisfree/cifamerica/2012/may/02/occupy-wall-street-panel-may-day';
const exampleCommentId = 27478733;

var messageI = 1;

function Ping(seq) {
	this.type = 'ping';
	this.date = new Date();
	
	if (seq) this.seq = seq;
}

function Pong(seq) {
	this.type = 'pong';
	this.date = new Date();
	
	if (seq) this.seq = seq;
}

function DirectReply(comment) {
	this.type = 'directreply';
	this.comment = comment;
}

function Message(subject, text) {
	this.type = 'message';
	this.id = Math.floor(Math.random() * 10000000);
	this.subject = subject;
	this.text = text;
}

function SoulmatesDM(sendername, text) {
	var messages = {
		1: ['hotlips34', 'Hey. Saw your profile on the Soulmates homepage, and thought you looked someone I might like to meet'],
		2: ['sloppyseconds', 'You are just what I am looking for. How about we go look at some ducks in hyde park?'],
		3: ['throbbingthird', 'What? You like dinosaurs too? Let get prehistoric together!']
	};

	var i = messageI > 3 ? 1 : messageI;
	var m = messages[i];
	messageI++;

	this.type = 'soulmatesDM';
	this.id = Math.floor(Math.random() * 10000000);
	this.sender = m[0];
	this.text = m[1];
}


function Keepalive() {
	this.type = 'keepalive';
}

function NewContent(id, headline, trail, url, thumbnail, authors) {
	this.type = 'newcontent';
	this.id = id;
	this.headline = headline;
	this.trail = trail;
	this.url = url;
	this.authors = authors;
}

function BreakingNews(id, headline, trail, url, thumbnail, authors) {
	NewContent.apply(this, arguments);
	this.type = 'breaking';
}


function handleComment(comment) {
	var notification = new DirectReply(comment);
	if (comment.responseTo) {
		// getting the user Id
		fetchComment(comment.responseTo.commentId, function(responseTo) {
			if (connections[responseTo.userProfile.userId]) {
				sendNotification(notification, connections[responseTo.userProfile.userId]);
			}
		});
	}
}

function extractAuthors(content) {
	var contributors = [];
	if (content.tags)
		contributors = content.tags.filter(function(each) {each.type = 'contributor'});
	return contributors.map(function(each) {each.webTitle});
}

function handleContent(content) {
	var notification = new NewContent(
		content.id,
		content.fields.headline,
		content.fields.trailText,
		content.webUrl,
		content.fields.thumbnail,
		extractAuthors(content));
		
	sendNotification(notification);
}

function handleBreakingNews(content) {
	var notification = new BreakingNews(
		content.id,
		content.fields.headline,
		content.fields.trailText,
		content.webUrl,
		content.fields.thumbnail,
		extractAuthors(content));
		
	sendNotification(notification);
}

function sendNotification(notification, to) {
	console.log('Sending notification: %j', notification);
	
	var json = JSON.stringify(notification);
	var recipients = to ? [to] : sockets;

	recipients.forEach(function(each) {
		each.send(json, function() { });
	});
}

function getBody(requestOrResponse, f) {
	var body = '';
	requestOrResponse.on('data', function(data) {
		body += data;
	});
	requestOrResponse.on('end', function() {
		f(body);
	});
}

function getJSONBody(requestOrResponse, f) {
	getBody(requestOrResponse, function(body) {
		f(JSON.parse(body));
	});
}

function fetchComment(id, callback) {
	var url = discussionAPIBase + 'comment/' + id;
	console.log('Fetching comment ' + id + ': ' + url);			
	http.get(url, function(res) {
		console.log('Got comment ' + id);
		getJSONBody(res, function(data) {
			if (data.status == 'ok')
				callback(data.comment);
		});
	});
}

function fetchContentAPI(id, callback) {
	var url = contentAPIBase + id + '?show-fields=all&show-tags=contributor';
	console.log('Fetching content for ' + id + ': ' + url);			
	http.get(url, function(res) {
		console.log('Got content for ' + id);
		getJSONBody(res, function(data) {
			if (data.response.status == 'ok')
				callback(data.response);
		});
	});
}

var sockets = [];
var connections = {};

var wss = new WebSocketServer({server: server});
wss.on('connection', function(ws) {
	ws.userId = ws.upgradeReq.url.replace('/', '');
	sockets.push(ws);
	connections[ws.userId] = ws;
	console.log('Pushed new socket. List size: ' + sockets.length);
	
    var id = setInterval(function() {
        sendNotification(new Keepalive(), ws);
    }, 45000);

    console.log('websocket connection open');

    ws.on('close', function() {
		console.log('websocket connection close');
		clearInterval(id);
        
        var index = sockets.indexOf(ws);
        if (index > -1) {
        	sockets.splice(index, 1);
        	delete connections[ws.userId];
        }
        console.log('Removed socket. List size: ' + sockets.length);
    });
    
    ws.on('message', function(data, flags) {
    	console.log('Message received: %s', data);
		var message = JSON.parse(data);

    	if (message.type == 'ping') {
    		console.log('Ping received');
    		sendNotification(new Pong(message.seq), ws);
    	} else if (message.type == 'pong') {
    		console.log('Pong received');
    	}
	});
	
	//sendNotification(new Message('Welcome!', 'You are receiving notifications from Guardian Trigger'), ws);
});

function amazonSNSHandler(req, res, notificationCallback, path) {
	var prefix = '';
	if (path) prefix = path + ' - ';
	
	var type = req.headers['x-amz-sns-message-type'];
	
	getJSONBody(req, function(postData) {		
		if (type == 'SubscriptionConfirmation') {
			console.log('%sAmazon SNS SubscriptionConfirmation received: %j', prefix, postData);
			var url = postData.SubscribeURL;
		
			https.get(url, function(res2) {
				console.log('Successfully confirmed with ' + url);
			});
		} else if (type == 'Notification') {
			console.log('%sAmazon SNS Notification received: %s', prefix, postData.Message);

			notificationCallback(JSON.parse(postData.Message));
		} else {
			console.log('%sUnhandled Amazon message type: %s', prefix, type);
		}

		res.send("OK");
	});
}

app.post('/comment', function(req, res) {
	amazonSNSHandler(req, res, function(message) {
		var commentId = message.comment_id;

		fetchComment(commentId, function(comment) {
			handleComment(comment);
		});
	}, '/comment');
});

app.post('/content', function(req, res) {
	amazonSNSHandler(req, res, function(message) {
		if (message.contentType == 'content') {
			fetchContentAPI(message.id, function(response) {
				handleContent(response.content);
			});
		}
	}, '/content');
});

app.get('/content', function(req, res) {
	var id = req.query.id ? req.query.id : exampleContentId;
	fetchContentAPI(id, function (response) {
		handleContent(response.content);
	});
	
	res.send('Notification sent!');
});

app.get('/breaking', function(req, res) {
	var id = req.query.id ? req.query.id : exampleContentId;
	fetchContentAPI(id, function (response) {
		handleBreakingNews(response.content);
	});
	
	res.send('Notification sent!');
});

app.get('/comment', function(req, res) {
	var id = req.query.id ? req.query.id : exampleCommentId;
	fetchComment(id, function (comment) {
		handleComment(comment);
	});
	
	res.send('Notification sent!');
});

// create a get endpoint to test with

app.get('/send', function(req, res) {
	if (req.query.message) {
		sendNotification(new Message(req.query.message));
		res.send('Message sent!');
	} else {
		res.send(400, 'No message specified');
	}
});

app.get('/soulmates', function(req, res) {
	sendNotification(new SoulmatesDM('hotlips34', 'Hey. Saw your profile on the Soulmates homepage, and thought you looked someone I might like to meet'));
	res.send('Message sent!');
});