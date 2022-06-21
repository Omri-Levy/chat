const socket = io(`http://${document.location.hostname}:80`);
const availableRooms = document.querySelector('.available-rooms');
const errorEl = document.querySelector('.error');

const onAvailableRooms = (rooms) => {
    availableRooms.innerHTML = ``;

    rooms.forEach(({room, subsCount}) => {
        const availableRoom = `
                <li>
                    <a href="/chat?room=${room}">${room}</a>
                    <span>${subsCount} user(s) in room</span>
                </li>
            `;

        availableRooms.insertAdjacentHTML('beforeend', availableRoom);
    })
}

const onError = (error) => {
    if (!error) return;

    errorEl.textContent = error;
}

const onConnectError = (error) => {
    if (!error) return;

    if (error.message === 'xhr poll error') {
        return errorEl.textContent = 'Connection failed...';
    }



    errorEl.textContent = error.message;
}

socket.on('error', onError);
socket.on('connect_error', onConnectError);
socket.on('available-rooms', onAvailableRooms);
