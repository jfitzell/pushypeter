if (location.origin === 'http://trigger.thegulocal.com') {
    console.log('James\' machine');
    const url = 'ws://localhost:5000';
} else {
    const url = location.origin.replace(/^http/, 'ws'); 
}

var ws;
var autoReconnect = false;
var n;
var user = id.getUserFromCookie();

window.addEventListener('load', function () {
    connect();

    Array.prototype.forEach.call(document.querySelectorAll('.actions button'), function(elem) {
        elem.addEventListener('click', function() {
            console.log(this)
            var url = this.getAttribute('data-action'),
                xhr = new XMLHttpRequest();
            
            // xhr.onreadystatechange = handleStateChange; // Implemented elsewhere.
            xhr.open('GET', url, true);
            xhr.send();
        });
    });
});


function connect() {
    if (ws || autoReconnect) {
        disconnect();
    }
    
    if (!havePermission())
        return requestPermission(function() { connect(); });
    
    autoReconnect = true;
    try {
        ws = new WebSocket(url +'/'+ '4339085');
    } catch (e) {
        
    }
    
    ws.onmessage = function(evt) {
        handle(evt); 
    };

    var keepaliveInterval;

    ws.onclose = function() {
        console.log("Conection was closed");
        if (keepaliveInterval) {
            clearInterval(keepaliveInterval);
            keepaliveInterval = null;
        }
        
        if (autoReconnect) {
            setTimeout(function() {
                if (ws.readyState > 1 && autoReconnect)
                    connect()
            }, 5000);
        }
    };
    
    ws.onopen = function() {
        console.log('Connected to %s', url);
        keepaliveInterval = setInterval(function() { sendKeepalive() }, 30000);
//      sendPing();
    }
}

function disconnect() {
    autoReconnect = false;
    
    if (ws) ws.close();
}

function sendPing() {
    if (ws) {
        ws.send(JSON.stringify({
            type: 'ping',
            date: new Date()
        }));
    }
}

function sendPong() {
    if (ws) {
        ws.send(JSON.stringify({
            type: 'pong',
            date: new Date()
        }));
    }
}

function sendKeepalive() {
    if (ws) {
        ws.send(JSON.stringify({
            type: 'keepalive'
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
    notify('discussion:reply', reply.comment.userProfile.displayName,
        reply.comment.discussion.title,
        function () {
            open(reply.comment.webUrl);
            this.close();
        });
}

function handleMessage(message) {
    notify('message', message.subject, message.text);
}

function handleSoulmatesDM(soulmatesDM) {
    notify('soulmates:dm', 'Soulmates: New message from ' + soulmatesDM.sender, soulmatesDM.text);
}

const handlers = {
    'ping': handlePing,
    'pong': handlePong,
    'directreply': handleDirectReply,
    'message': handleMessage,
    'soulmatesDM': handleSoulmatesDM
};

//////////

function handle(evt) {
    var obj = eval ("(" + evt.data + ")");

    var handler = handlers[obj.type];
    if (handler) {
        handler(obj);
    } else {
        console.log('Unknown type: %s', obj.type);
    }   
}

function notify(id, title, body, onclick) {
    if (havePermission()) {
        console.log('Notify: '+ id);
        var n = new Notification(title, {
            body: body,
            icon: 'img/notification-icons/'+ id.split(':')[0] +'.png',
            tag: 'gu:notify:' + id
        });
    
        if (onclick) n.onclick = onclick;
        
        // Callback function when the notification is closed.
        n.onclose = function () {
            console.log('Notification closed');
        };
        
        return n;
    } else {
        console.log('No permission to notify - ignoring notification');
        return null;
    }
}