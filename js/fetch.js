/* Fetches the content of different HTMLs and sets it as the innerHTML of the specified HTML element with the class '<content>-html' */

/* fetch navbar HTML */
const nav = document.querySelector('.navbar-html')
fetch('templates/navbar.html')
.then(res=>res.text())
.then(data=>{
    nav.innerHTML=data
})

/* fecthing multiple divs at once */
function divFetching(selector, path) {
    const div = document.querySelector(selector);
    fetch(path)
        .then(res => res.text())
        .then(data => {
            div.innerHTML = data;
        });
}

divFetching('.carousel-html', 'templates/carousel.html');
divFetching('.about-html', 'templates/about.html');
divFetching('.contact-html', 'templates/contact.html');