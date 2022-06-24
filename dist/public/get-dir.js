function getDir(str) {
	const isHebrew = /[א-ת]/g;

	return isHebrew.test(str) ? `rtl` : `ltr`;
}
