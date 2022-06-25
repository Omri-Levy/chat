const searchParams = new URLSearchParams(window.location.search);
const sessionId = localStorage.getItem(`chat:sessionId`);
const connect = (socket, username) => {
	searchParams.set(`username`, username);
	const newPath = `${window.location.pathname}?${searchParams.toString()}`;

	history.replaceState(null, ``, newPath);

	socket.auth = {
		sessionId,
		username,
		room,
	};

	socket.connect();
};
const generateUsername = (message) => {
	const random = `${Date.now()}`.slice(-4);

	return prompt(message) || `Anonymous${random}`;
};
const room = searchParams.get(`room`) ?? `General`;
const username =
	searchParams.get(`username`) || generateUsername(`Username:\n`);
const usersEl = document.querySelector(`.users`);
const formEl = document.querySelector(`form`);
const textareaEl = document.querySelector(`textarea`);
const messagesEl = document.querySelector(`.messages`);
const pageTitleEl = document.querySelector(`h2`);
const errorEl = document.querySelector(`.error`);
const isTypingContainerEl = document.querySelector(`.is-typing-container`);
const socket = io(`https://${document.location.hostname}:443/chat`, {
	autoConnect: false,
	secure: true,
});
connect(socket, username);

const renderMessage = ({ avatar, from, body, timestamp }) => {
	const date = new Date(timestamp);
	const isToday = new Date().getDate() !== date.getDate();
	const formattedDate = date
		.toLocaleString(navigator in window ? navigator.language : `en-US`, {
			hour: `numeric`,
			minute: `numeric`,
			...(isToday
				? {
						year: `numeric`,
						month: `numeric`,
						day: `numeric`,
				  }
				: {}),
		})
		.replace(`,`, ` -`);
	const isSameUser = from === username;

	const html = `
        <li class="message-item grid grid-cols-auto-1 border-b">
                      <div class="avatar mr-2">
            ${avatar}
            </div>
            <div class="flex">
                <strong class="mt-2px username break-words" dir="auto">${
					isSameUser ? `You` : from
				}:</strong>
                <div class="flex mx-primary message" dir="auto">
                   ${body}
                </div>
            </div>
            <time class="col-span-full mt-primary">${formattedDate}</time>
         </li>
        `;

	messagesEl.insertAdjacentHTML(`beforeend`, html);
	messagesEl.scrollTo(0, messagesEl.scrollHeight);
};

const onSubmit = (e) => {
	e.preventDefault();

	const body = textareaEl.value;

	if (!body) return;

	errorEl.textContent = ``;
	socket.timeout(5000).emit(`message`, body, (res, err) => {
		if (!res?.message && !err?.message) return;

		let message = err?.message ?? res?.message;

		if (message === `operation has timed out`) {
			message = `Connection timed out...`;
		}

		errorEl.textContent = message;
	});
	textareaEl.value = ``;
};

const onConnectError = ({ message = `Something went wrong..`, data }) => {
	errorEl.textContent = ``;

	switch (message) {
		case `xhr poll error`:
			return (errorEl.textContent = `Failed to connect..`);
		case `Validation Error`:
			const errors = data.join(`\n`);

			alert(errors);

			window.location.href = `/`;
			return;
		case `Username "${username}" already exists`:
			connect(
				socket,
				generateUsername(
					`Username "${username}" already exists, please choose a different one:\n`
				)
			);
			return;
		default:
			errorEl.textContent = message;
			return;
	}
};

const onError = ({ message }) => {
	if (!message) return;

	if (message === `Room "${room}" does not exist`) {
		alert(message);

		return (window.location.href = `/`);
	}

	errorEl.textContent = message;
};

const onUsers = (usersArr) => {
	usersEl.innerHTML = ``;

	usersArr.forEach(({ username }) => {
		const userEl = document.createElement(`li`);

		userEl.classList.add(`mb-primary`);
		usersEl.dir = `auto`;
		userEl.textContent = username;
		usersEl.appendChild(userEl);
	});
};

const onPageshow = (e) => {
	if (!e.persisted) return;

	window.location.reload();
};

const onConnect = () => {
	errorEl.textContent = ``;
};

const onSession = ({ sessionId }) => {
	socket.auth.sessionId = sessionId;
	localStorage.setItem(`chat:sessionId`, sessionId);
};
let timeout = null;
let isTyping = false;
const peopleTyping = [];
const onInput = () => {
	clearTimeout(timeout);
	timeout = setTimeout(() => {
		isTyping = false;
		socket.emit(`stop-typing`);
	}, 20000);

	if (isTyping) return;

	isTyping = true;
	socket.emit(`start-typing`);
};

const createIsTypingEl = (user, message) => {
	const isTypingEl = document.createElement(`div`);

	isTypingEl.classList.add(`is-typing`);
	isTypingEl.textContent = `${user}${message}`;
	isTypingContainerEl.appendChild(isTypingEl);
};
const renderIsTyping = () => {
	isTypingContainerEl.innerHTML = ``;

	if (peopleTyping.length >= 3) {
		createIsTypingEl(`Multiple people`, ` are typing`);

		return;
	}

	peopleTyping.forEach((user) => {
		createIsTypingEl(user, ` is typing`);
	});
};

pageTitleEl.textContent = `Room name: ${room}`;
socket.on(`start-typing`, ({ username }) => {
	peopleTyping.push(username);
	renderIsTyping();
});
socket.on(`stop-typing`, ({ username }) => {
	peopleTyping.splice(peopleTyping.indexOf(username), 1);
	renderIsTyping();
});
socket.on(`session`, onSession);
socket.on(`connect`, onConnect);
socket.on(`message`, renderMessage);
socket.on(`users`, onUsers);
socket.on(`connect_error`, onConnectError);
socket.on(`error`, onError);
formEl.addEventListener(`submit`, onSubmit);
window.addEventListener(`pageshow`, onPageshow);
textareaEl.addEventListener(`input`, onInput);
