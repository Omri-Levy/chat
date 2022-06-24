const socket = io(`http://${document.location.hostname}:80`);
const availableRooms = document.querySelector(`.available-rooms`);
const errorEl = document.querySelector(`.error`);
const form = document.querySelector(`form`);

const onAvailableRooms = (rooms) => {
	availableRooms.innerHTML = ``;

	rooms.forEach(({ room, subsCount }) => {
		const availableRoom = `
                <li class="border-b py-primary flex items-center justify-between">
                <div class="flex items-center">
                    <h5 class="mt-primary mr-primary">
                    Room:
                    </h5>
                    <a class="room-link" href="/chat?room=${room}">${room}</a>
                    </div>
                    <span>${subsCount} user(s) in room</span>
                </li>
            `;

		availableRooms.insertAdjacentHTML(`beforeend`, availableRoom);
	});
};

const onError = (error) => {
	if (!error?.message) return;

	errorEl.textContent = error.message;
};

const onConnectError = (error) => {
	if (!error?.message) return;

	if (error.message === `xhr poll error`) {
		return (errorEl.textContent = `Connection failed...`);
	}

	errorEl.textContent = error.message;
};

const onSubmit = (e) => {
	e.preventDefault();

	errorEl.textContent = ``;
	const formData = new FormData(e.target);
	const room = formData.get(`room`)?.toString();

	if (!room) return;

	socket.timeout(5000).emit(`create`, room, (res, err) => {
		const message = err?.message ?? res?.message;

		switch (message) {
			case undefined:
				window.location.href = `/chat?room=${room}`;
				return;
			case `operation has timed out`:
				errorEl.textContent = `Connection timed out...`;
				return;
			case `Validation Error`:
				errorEl.textContent = err.data.join(`\n`);
				return;
			default:
				errorEl.textContent = message;
				return;
		}
	});
};

const onPageshow = (e) => {
	if (!e.persisted) return;

	window.location.reload();
};

socket.on(`error`, onError);
socket.on(`connect_error`, onConnectError);
socket.on(`available-rooms`, onAvailableRooms);
form.addEventListener(`submit`, onSubmit);
window.addEventListener(`pageshow`, onPageshow);
