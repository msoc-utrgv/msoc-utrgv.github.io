// Sample JSON data
var members_json = {
    "members": [
        {
            "id": "marinanacinanceno-president",
            "name": "Marina Nacinanceno",
            "position": "President",
            "email": "marina.nacianceno01@utrgv.edu"
        },
        {
            "id": "benonispradlin-vicepresident",
            "name": "Ben-Oni Spradlin",
            "position": "Vice-President",
            "email": "benoni.spradlin01@utrgv.edu"
        },
        {
            "id": "raulmarquez-treasurer",
            "name": "Raul Marquez",
            "position": "Treasurer",
            "email": "raul.marquez02@utrgv.edu"
        },
        {
            "id": "hailymartinez-secretary",
            "name": "Haily Martinez",
            "position": "Secretary",
            "email": "haily.martinez01@utrgv.edu"
        },
        {
            "id": "josephalanis-facultyadvisor",
            "name": "Joseph Alanis",
            "position": "Faculty Advisor",
            "email": "joseph.alanis@utrgv.edu"
        },
        {
            "id": "andrewalaniz-facultyadvisor",
            "name": "Andrew Alaniz",
            "position": "Faculty Advisor",
            "email": "andrew.alaniz01@utrgv.edu"
        },
        {
            "id": "timothyhuber-facultyadvisor",
            "name": "Timothy Huber",
            "position": "Faculty Advisor",
            "email": "timothy.huber@utrgv.edu"
        },
        {
            "id": "guillermogarza-facultyadvisor",
            "name": "Guillermo Garza",
            "position": "Faculty Advisor",
            "email": "guillermo.garza@utrgv.edu"
        },
        {
            "id": "mikelindstrom-facultyadvisor",
            "name": "Mike Lindstrom",
            "position": "Faculty Advisor",
            "email": "mike.lindstrom@utrgv.edu"
        },
        {
            "id": "andrewsebok-facultyadvisor",
            "name": "Andrew Sebok",
            "position": "Faculty Advisor",
            "email": "andrew.sebok@utrgv.edu"
        }
    ]
};

// Loop through the members array
var htmls = `<div class="container"><div class="row grayscale">`;
members_json.members.forEach(function(member) {
    htmls += `<div class="col-md-4 text-center my-4">
                <img src="/media/photos/${member.id}.jpg" alt="Marina" class="mb-3" style="width: 80%; height: 45vh; object-fit: cover;">
                <h5>${member.id}</h5>
                <p class="work-sans-700">${member.name}</p>               
                <p class="h4">${member.position}</p>
                <a href="mailto:${member.email}" style="margin: 0px; padding: 0px; text-decoration: none">${member.email}</a>
            </div>`;
});
htmls += `</div></div>`;

// Set the HTML to the element with id "outer"
$("#members-html").html(htmls);
