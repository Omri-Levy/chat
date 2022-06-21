const searchParams = new URLSearchParams(window.location.search);
const username = searchParams.get('username') || prompt('Username:\n') || 'Anonymous';
searchParams.set('username', username);
const newPath = `${window.location.pathname}?${searchParams.toString()}`;

history.replaceState(null, '', newPath);

const room = searchParams.get('room') ?? 'General';
const users = document.querySelector('.users');
const form = document.getElementById('form');
const input = document.getElementById('input');
const messages = document.getElementById('messages');
const pageTitle = document.querySelector('h1');
const errorEl = document.querySelector('.error');
const socket = io(`http://${document.location.hostname}:80/chat`, {
    query: {
        username,
        room,
    },
});

const renderMessage = ({from, body, timestamp}) => {
    const date = new Date(timestamp);
    const isToday = new Date().getDate() !== date.getDate();
    const formattedDate = date
        .toLocaleString(
            navigator in window ? navigator.language : `en-US`,
            {
                hour: `numeric`,
                minute: `numeric`,
                ...(isToday
                    ? {
                        year: `numeric`,
                        month: `numeric`,
                        day: `numeric`,
                    }
                    : {}),
            }
        )
        .replace(`,`, ` -`);

    const html = `
        <li>
            <div class="message-container">
                <strong>${from === username ? 'You' : from}:</strong>
                <div class="message">${body}</div>
            </div>
            <time class="timestamp">${formattedDate}</time>
         </li>
        `;

    messages.insertAdjacentHTML('beforeend', html);
    messages.scrollTo(0, messages.scrollHeight);
};

const onSubmit = (e) => {
    e.preventDefault();

    const body = input.value;

    if (!body) return;

    socket.timeout(5000).emit('message', body, (res, err) => {
        if (!err && !res) return;

        let message = err ?? res?.message;

        if (message === 'operation has timed out') {
            message = 'Connection timed out...';
        }

        errorEl.textContent = message;
    });
    input.value = '';
}

const onConnectError = (payload) => {
    if (!(payload instanceof Error)) {
        return renderMessage(payload);
    }

    switch(payload.message) {
        case 'xhr poll error':
            return errorEl.textContent = 'Connection failed...';
        case 'Validation Error':
            alert(payload.data.join('\n'));

            return window.location.href = `/`;
        default:
            return errorEl.textContent = payload.message;
    }
}

const onError = (error) => {
    if (!error) return;

    alert(error);
}

const onUsers = (usersArr) => {
    users.innerHTML = ``;

    usersArr.forEach(({username}) => {
        const user = document.createElement('li');

        user.textContent = username;
        users.appendChild(user);
    })
}

const onPageshow = (e) => {
    if (!e.persisted) return;

    window.location.reload();
}

pageTitle.innerText = `Room name: ${room}`;
socket.on('message', renderMessage);
socket.on('users', onUsers);
socket.on('connect_error', onConnectError);
socket.on('error', onError);
form.addEventListener('submit', onSubmit);
window.addEventListener('pageshow', onPageshow)