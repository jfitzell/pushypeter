if (location.origin === 'http://trigger.thegulocal.com') {
    console.log('James\' machine');
    var url = 'ws://localhost:5000';
} else {
    var url = location.origin.replace(/^http/, 'ws'); 
}

var socket;
var n;
var user = id.getUserFromCookie();
var userId = localStorage.getItem('gu:trigger:userId') || '21801084';

window.addEventListener('load', function () {
    connect();

    Array.prototype.forEach.call(document.querySelectorAll('.actions button[data-action]'), function(elem) {
        elem.addEventListener('click', function() {
            var url = this.getAttribute('data-action'),
                xhr = new XMLHttpRequest();
            
            // xhr.onreadystatechange = handleStateChange; // Implemented elsewhere.
            xhr.open('GET', url, true);
            xhr.send();
        });
    });

    document.getElementById('user-id').value = userId;

    document.getElementById('set-user-id').addEventListener('click', function() {
        var newId = document.getElementById('user-id').value;
        if (newId) {
            userId = newId;
            localStorage.setItem('gu:trigger:userId', userId);
            if (socket.socket.connected)
            	sendUserId();
            
            console.log('User set to '+ userId);
        } else {
            alert('Non. Not valid.');
        }
    });
});


function connect() {
    if (socket) {
        disconnect();
    }
    
    if (!havePermission())
        return requestPermission(function() { connect(); });
    
    socket = io.connect(url);
    socket.on('connect', function() {
    	console.log('Connected to %s', url);
		
		socket.on('message', function(message) {
			handle(message); 
		});

		socket.on('disconnect', function() {
			console.log('Conection was closed');
		});
		
		sendUserId();
	});
}

function disconnect() {
    if (socket)
    	socket.disconnect();
}

function sendUserId() {
	socket.emit('set-user-id', userId);
}

function sendPing() {
    if (socket) {
        socket.send(JSON.stringify({
            type: 'ping',
            date: new Date()
        }));
    }
}

function sendPong() {
    if (socket) {
        socket.send(JSON.stringify({
            type: 'pong',
            date: new Date()
        }));
    }
}


function requestPermission(callback) {
    if (supportNotifications()) {
        console.log('Requesting permission from user to display notifications');
        Notification.requestPermission(function (status) {
            // This allows to use Notification.permission with Chrome/Safari
            if (Notification.permission !== status) {
                Notification.permission = status;
            }
            console.log('New permission state: %s', status);
            
            if (callback)
                callback(status);
        });
    }
}

function havePermission() {
    return supportNotifications() && Notification.permission == 'granted';
}

function supportNotifications() {
    if (!'Notification' in window) {
        // If the browser version is unsupported, remain silent.
        console.log('Notifications not supported in this browser');
        return false;
    } else {
        return true;
    }
}


///// parsers /////


function handlePing(ping) {
    console.log('Ping received; sent at %s', ping.date);
    sendPong();
}

function handlePong(pong) {
    var n = notify('pong', 'Reply from {USERNAME}', 'First few characters of comment...\nClick here to reply to {USERNAME}', showReply);
    if (n) setTimeout(function() {n.close()}, 2000);
}

function showReply() {
    window.open('http://discussion.theguardian.com/post?key=p%2F39f5z', 'gu:discussion', 'width=650,height=350');
}

function handleDirectReply(reply) {
    notify('discussion:reply:' + reply.comment.id,
        'Reply to your comment from '+ reply.comment.userProfile.displayName,
        reply.comment.body,
        function () {
            var url = mUrl(reply.comment.discussion.webUrl)+'#comment-'+ reply.comment.id;
            window.open(url);
            this.close();
        });
}

function mUrl(url) {
    return url
            .replace('http://www.theguardian.com/', 'http://m.code.dev-theguardian.com/')
            .replace('http://www.code.dev-theguardian.com/', 'http://m.code.dev-theguardian.com/');
}

function handleMessage(message) {
    notify('message:' + message.id, message.subject, message.text);
}

function handleSoulmatesDM(message) {
    notify('soulmates:dm:' + message.id, 'Soulmates: New message from ' + message.sender, message.text, function() {
        window.open('https://soulmates.theguardian.com/');
    });
}

function handleBreaking(breaking) {
    notify('breaking:' + breaking.id, 'BREAKING: ' + breaking.headline, breaking.trail, function() {
        window.open(mUrl(breaking.url));
    });
}

function handleNewContent(content) {
    notify('content:' + content.id, content.headline, content.trail, function() {
        window.open(mUrl(content.url));
    });
}

var handlers = {
    'newcontent': handleNewContent,
    'ping': handlePing,
    'pong': handlePong,
    'directreply': handleDirectReply,
    'message': handleMessage,
    'soulmatesDM': handleSoulmatesDM,
    'breaking': handleBreaking
};

//////////

function strip(html) {
   var tmp = document.createElement('div');
   tmp.innerHTML = html;
   return tmp.textContent || tmp.innerText || '';
}

function handle(message) {
    var notification = eval ("(" + message + ")");

    var handler = handlers[notification.type];
    if (handler) {
        handler(notification);
    } else {
        console.log('Unknown type: %s', notification.type);
    }   
}

function notify(id, title, body, onclick) {
    if (havePermission()) {
        var n = new Notification(title, {
            body: strip(body),
            icon: 'img/notification-icons/'+ id.split(':')[0] +'.png',
            tag: 'gu:notify:' + id
        });
        
        if (onclick) n.onclick = onclick;
        return n;
    } else {
        console.log('No permission to notify - ignoring notification');
        return null;
    }
}