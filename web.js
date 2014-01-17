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


const exampleComment = {
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
};

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
	this.subject = subject;
	this.text = text;
}

function SoulmatesDM(sendername, text) {
	this.type = 'soulmatesDM';
	this.sender = sendername;
	this.text = text;
}


function Keepalive() {
	this.type = 'keepalive';
}

function NewContent(headline, trail, url, thumbnail, authors) {
	this.type = 'newcontent';
	this.headline = headline;
	this.trail = trail;
	this.url = url;
	this.authors = authors;
}

function BreakingNews(headline, trail, url) {
	this.type = 'breaking';
	this.headline = headline;
	this.trail = trail;
	this.url = url;
}


function handleComment(comment) {
	var notification = new DirectReply(comment);
	if (comment.responseTo) {
		// getting the user Id
		fetchComment(comment.responseTo.commentId, function(responseTo) {
			sendNotification(notification, connections[responseTo.userProfile.userId]);
		});
	} /*else {
		sendNotification(notification);
	}*/
}

function handleContent(content) {
	var contributors = [];
	if (content.tags)
		contributors = content.tags.filter(function(each) {each.type = 'contributor'});
	var authors = contributors.map(function(each) {each.webTitle});

	var notification = new NewContent(
		content.fields.headline,
		content.fields.trailText,
		content.webUrl,
		content.fields.thumbnail,
		authors);
		
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
	
	sendNotification(new Message('Welcome!', 'You are receiving notifications from Guardian Trigger'), ws);
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
		if (message.contentType == 'section') { // 'content'
			fetchContentAPI(message.id, function(response) {
				handleContent(response.results[0]);
			});
		}
	}, '/content');
});

app.get('/comment', function(req, res) {
	if (req.query.id) {
		fetchComment(req.query.id, function (comment) {
			handleComment(comment);
		});
	} else {
		handleComment(exampleComment);
	}
	
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