const socket = io(`http://${document.location.hostname}:80`);
const availableRooms = document.querySelector('.available-rooms');

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

    alert(error);
}

socket.on('error', onError);
socket.on('available-rooms', onAvailableRooms);
