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

function showDebuggingLinks() {
	document.getElementById('debugging').style.display="block";
}

function connect() {
    if (socket && socket.socket.connecting) {
        disconnect();
    }

    if (!havePermission())
        return requestPermission(function() { connect(); });

	if (! socket) {
		socket = io.connect(url);
		socket.on('connect', function() {
			console.log('Connected to %s', url);
			updateStatus('Connected');
		
			sendUserId();
		});
		
		socket.on('message', function(message) {
			handle(message); 
		});

		socket.on('disconnect', function() {
			console.log('Conection was closed');
			if (socket.socket.reconnecting) // TODO: this doesn't seem to be true at this point
				updateStatus('Connection lost. Reconnecting...');
			else
				updateStatus('Disconnected');
		});
	
		socket.on('reconnect_failed', function() {
			console.log('Auto-reconnect failed... giving up.');
			updateStatus('Disconnected');
			notify('reconnect-failed', 'Trigger connection lost', 'Click to try reconnecting', function() {connect()});
		});
	}
   
    if (! socket.socket.connectiong) {
		// On disconnect/reconnect, this doesn't seem to auto connect
		//  (I think it's re-using the socket)
		socket.socket.connect()    	
    }
    updateStatus('Connecting...');
}

function disconnect() {
    if (socket)
    	socket.disconnect();
}

function updateStatus(status) {
	console.log(status);
	document.getElementById('status').innerHTML = status;
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
    var n = notify('pong', 'Pong!', 'Response received from server');
    if (n) setTimeout(function() { n.close() }, 2000);
}


function handleDirectReply(reply) {
    notify('discussion:reply:' + reply.comment.id,
        'Reply to your comment from '+ reply.comment.userProfile.displayName,
        reply.comment.body,
        function () {
            window.open(reply.comment.webUrl);
            this.close();
        });
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
        window.open(breaking.url);
    });
}

function handleNewContent(content) {
    notify('content:' + content.id, content.headline, content.trail, function() {
        window.open(content.url);
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