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
const users = document.querySelector(`.users`);
const form = document.querySelector(`form`);
const input = document.querySelector(`textarea`);
const messages = document.querySelector(`.messages`);
const pageTitle = document.querySelector(`h2`);
const errorEl = document.querySelector(`.error`);
const socket = io(`http://${document.location.hostname}:80/chat`, {
	autoConnect: false,
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

	const html = `
        <li class="message-item grid grid-cols-auto-1 border-b">
                      <div class="avatar">
            ${avatar}
            </div>
            <div class="flex">
                <strong class="mt-2px">${
					from === username ? `You` : from
				}:</strong>
                <div class="flex mx-primary message">
                   ${body}
                </div>
            </div>
            <time class="inline-block mt-primary">${formattedDate}</time>
         </li>
        `;

	messages.insertAdjacentHTML(`beforeend`, html);
	messages.scrollTo(0, messages.scrollHeight);
};

const onSubmit = (e) => {
	e.preventDefault();

	const body = input.value;

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
	input.value = ``;
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
	users.innerHTML = ``;

	usersArr.forEach(({ username }) => {
		const user = document.createElement(`li`);

		user.classList.add(`mb-primary`);
		user.textContent = username;
		users.appendChild(user);
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

pageTitle.textContent = `Room name: ${room}`;
socket.on(`session`, onSession);
socket.on(`connect`, onConnect);
socket.on(`message`, renderMessage);
socket.on(`users`, onUsers);
socket.on(`connect_error`, onConnectError);
socket.on(`error`, onError);
form.addEventListener(`submit`, onSubmit);
window.addEventListener(`pageshow`, onPageshow);
