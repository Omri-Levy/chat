const searchParams = new URLSearchParams(window.location.search);
const username = searchParams.get('username') ?? 'Anonymous';
const room = searchParams.get('room') ?? 'General';
const form = document.getElementById('form');
const input = document.getElementById('input');
const messages = document.getElementById('messages');
const pageTitle = document.querySelector('header h1');
const socket = io(`http://${document.location.hostname}:80`, {
    query: {
        username,
        room,
    }
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
                <p class="message">${body}</p>
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

    const message = {
        body,
        from: username,
        timestamp: new Date()
    };

    renderMessage(message);

    socket.emit('message', message);
    input.value = '';
}

const onConnectError = (message) => {
    if (!message.body) return;

    renderMessage(message);
}

pageTitle.innerText = `Room name: ${room}`;
socket.on('message', renderMessage);
socket.on('connect_error', onConnectError);
form.addEventListener('submit', onSubmit);