// leaflet.
var map;
var southWest = L.latLng(29.3, 34.2);
var northEast = L.latLng(33.5, 35.9);
var bounds = L.latLngBounds(southWest, northEast);

var mapIcon = L.icon({
    iconUrl: 'assets/mapIcon.svg',
    shadowUrl: 'assets/mapIconShadow.svg',

    iconSize: [27, 67], // size of the icon
    shadowSize: [35, 45], // size of the shadow
    iconAnchor: [15, 66], // point of the icon which will correspond to marker's location
    shadowAnchor: [3, 43], // the same for the shadow
    popupAnchor: [-2, -53] // point from which the popup should open relative to the iconAnchor
});

// JSONdata.
let feature;
let props;
let theData;

// popUp.
let currentFacility = 0;
let currentImg = 0;
let isImgBig = false;

// filtering.
let isFilterTypeOpen = false;
let isFilterAreaOpen = false;
let filterTypeArr = [];
let filterAreaArr = [];
let filterNames = [];
let geoJsonLayer;

let searching;

// L.Icon.Default.mergeOptions({
//     iconUrl: 'assets/mapIcon.svg',
//     shadowUrl: 'assets/mapIconShadow.svg',
// });

window.addEventListener('load', () => {

    map = L.map("map", {
        maxBounds: bounds,
        maxBoundsViscosity: 1.0,
        // }).setView([31.5, 35.0], 8);
    }).setView([31.5, 35.0], 8.5);

    L.tileLayer("Israel/{z}/{x}/{y}.png", {
        // minZoom: 8,
        minZoom: 8.5,
        maxZoom: 10,
        tms: true,
    }).addTo(map);

    fetch("./data.geojson") //קישור של קובץ json.
        .then(response => response.json())
        .then(data => {
            theData = data;

            filtering(theData);
            addMarkers(theData);
        })
        .catch(error => {
            console.error("Error loading GeoJSON:", error);
        });

    document.querySelectorAll('.filteringIcon').forEach((filter) => {
        filter.addEventListener('click', openFilter);
    })

    document.getElementById('search').addEventListener('input', searchInput);
});

const addMarkers = (theData) => {
    if (geoJsonLayer) {
        map.removeLayer(geoJsonLayer);
    }

    geoJsonLayer = L.geoJSON(theData, { //הוספת הנקודות.
        filter: function (feature) {
            if (((filterTypeArr.length > 0) || (filterAreaArr.length > 0)) && filterNames.length === 0) {
                return false;
            }
            if (filterNames.length === 0) {
                return true;
            }

            return filterNames.includes(feature.properties.nameOfFacility);
        },

        pointToLayer: function (feature, latlng) {
            return L.marker(latlng, {
                icon: mapIcon
            });
        },

        onEachFeature: function (feature, layer) { //הוספת ToolTip.
            if (feature.properties?.nameOfFacility) {
                layer.bindTooltip(feature.properties.nameOfFacility, {
                    direction: "top",
                    offset: [-1, -40]
                });
            }

            layer.addEventListener('click', () => openPopup(feature));
        }

    }).addTo(map);
}

const filtering = (theData) => {
    document.getElementById('cards').innerHTML = '';
    filterNames = [];
    theData.features.forEach((feature) => {
        props = feature.properties;

        if ((filterTypeArr.length !== 0) || (filterAreaArr.length !== 0)) {
            document.getElementById('filterTags').style.marginTop = '2vh';
            // document.getElementById('cards').style.

            if ((filterTypeArr.length !== 0) && (filterAreaArr.length !== 0)) {
                for (let t = 0; t < filterTypeArr.length; t++) {
                    for (let i = 0; i < props.TypesOfFacilities.length; i++) {
                        if (filterTypeArr[t] === props.TypesOfFacilities[i].typeOfFacility) {
                            for (let a = 0; a < filterAreaArr.length; a++) {
                                if (filterAreaArr[a] === props.areaInTheCountry) {
                                    if (!filterNames.includes(props.nameOfFacility)) {//??
                                        filterNames.push(props.nameOfFacility);
                                        // console.log(filterNames);//
                                    }
                                }
                            }
                        }
                    }
                }
            } else if (filterTypeArr.length !== 0) {
                for (let t = 0; t < filterTypeArr.length; t++) {
                    for (let i = 0; i < props.TypesOfFacilities.length; i++) {
                        if (filterTypeArr[t] === props.TypesOfFacilities[i].typeOfFacility) {
                            if (!filterNames.includes(props.nameOfFacility)) {//??
                                filterNames.push(props.nameOfFacility);
                            }
                        }
                    }
                }
            } else if (filterAreaArr.length !== 0) {
                for (let a = 0; a < filterAreaArr.length; a++) {
                    if (filterAreaArr[a] === props.areaInTheCountry) {
                        if (!filterNames.includes(props.nameOfFacility)) {//??
                            filterNames.push(props.nameOfFacility);
                        }
                    }
                }
            }

            if (filterNames.includes(props.nameOfFacility)) {
                addCards(feature);
            }

        } else {
            document.getElementById('filterTags').style.marginTop = '0vh';
            addCards(feature);
        }
    });

    console.log(filterNames);//
}

const addCards = (feature) => {
    const card = document.createElement('div');
    card.className = 'card';
    document.getElementById('cards').appendChild(card);

    const cardTitle = document.createElement('h3');
    cardTitle.className = 'cardTitle';
    cardTitle.innerText = props.nameOfFacility;
    card.appendChild(cardTitle);

    const cardAddress = document.createElement('div');
    cardAddress.className = 'cardAddress';
    card.appendChild(cardAddress);

    const cardAddressIcon = document.createElement('span');
    cardAddressIcon.className = 'cardAddressIcon';
    cardAddress.appendChild(cardAddressIcon);

    const cardAddressText = document.createElement('p');
    cardAddressText.className = 'cardAddressText';
    cardAddressText.innerText = props.locationOfFacility;
    cardAddress.appendChild(cardAddressText);

    const cardTags = document.createElement('div');
    cardTags.className = 'cardTags';
    card.appendChild(cardTags);

    for (let i = 0; i < props.TypesOfFacilities.length; i++) {
        const cardTag = document.createElement('span');
        cardTag.className = 'cardTag';
        cardTags.appendChild(cardTag);

        const tagIcon = document.createElement('div');
        tagIcon.className = 'tagIcon';
        cardTag.appendChild(tagIcon);

        const tagType = document.createElement('p');
        tagType.className = 'tagType';
        tagType.innerText = props.TypesOfFacilities[i].typeOfFacility;
        switch (props.TypesOfFacilities[i].typeOfFacility) {
            case ("לש''בית מכולות"):
                cardTag.classList.add('lashbitMeholot');
                break;
            case ("מטווחים"):
                cardTag.classList.add('mitvahim');
                break;
            case ("חדר ירי"):
                cardTag.classList.add('hederYery');
                break;
            case ("לש''בית עץ"):
                cardTag.classList.add('lashbitEz');
                break;
        }
        cardTag.appendChild(tagType);
    }

    card.addEventListener('click', () => openPopup(feature));
}

const openPopup = (feature) => {
    feature = feature;
    props = feature.properties;
    currentFacility = 0;
    isImgBig = false;


    document.getElementById('popUpBackground').style.display = 'block';
    document.getElementById('popUp').style.animation = 'openPopUp 0.5s ease';

    document.getElementById('closePopUp').addEventListener('click', closePopup);

    createNavBar();
    displayInfo();
    displayImg();
}

const closePopup = () => {
    document.getElementById('closePopUp').removeEventListener('click', closePopup);
    document.getElementById('popUp').style.animation = 'closePopUp 0.5s ease';

    setTimeout(() => {
        document.getElementById('popUpBackground').style.display = 'none';
    }, 500);
}

const createNavBar = () => {
    document.getElementById('popUpNavBar').innerHTML = '';
    for (let i = 0; i < props.TypesOfFacilities.length; i++) {
        const navItem = document.createElement('p');
        navItem.id = `navItem${i}`;
        if (i === currentFacility) {
            navItem.className = 'navItemPressed';
        } else {
            navItem.className = 'navItem';
            navItem.addEventListener('click', navPopUp)
        }
        document.getElementById('popUpNavBar').appendChild(navItem);
        navItem.innerText = props.TypesOfFacilities[i].typeOfFacility;
    }
}

const displayInfo = () => {
    document.getElementById('popUpTitle').innerText = props.nameOfFacility;
    document.getElementById('popUpSubTitle').innerText = props.locationOfFacility;
    document.getElementById('unitText').innerText = props.unitOwningTheFacility;
    document.getElementById('typeText').innerText = props.TypesOfFacilities[currentFacility].specificTypeOfFacility;
    document.getElementById('frameText').innerText = props.TypesOfFacilities[currentFacility].trainingFrame;

    addTrainingOptions();

    document.getElementById('commentsText').innerText = props.TypesOfFacilities[currentFacility].comments;
}

const addTrainingOptions = () => {
    document.getElementById("optionsContainer").innerHTML = '';
    for (let i = 0; i < props.TypesOfFacilities[currentFacility].trainingOptions.length; i++) {
        const option = document.createElement('span');
        document.getElementById("optionsContainer").appendChild(option);
        option.innerText = props.TypesOfFacilities[currentFacility].trainingOptions[i];
    }
}

const navPopUp = (event) => {
    currentFacility = event.currentTarget.id.charAt(7);
    document.querySelector('.navItemPressed').addEventListener('click', navPopUp);
    document.querySelector('.navItemPressed').className = 'navItem';
    document.getElementById(event.currentTarget.id).className = 'navItemPressed';

    displayInfo();
    displayImg();
}

const displayImg = () => {
    currentImg = 0;//
    document.getElementById('popUpImgContainer').style.backgroundImage = `URL(${props.TypesOfFacilities[currentFacility].imgArr[currentImg]}`;
    document.getElementById('imgBigImg').src = props.TypesOfFacilities[currentFacility].imgArr[currentImg];
    document.getElementById("imgDots").innerHTML = '';

    if (props.TypesOfFacilities[currentFacility].imgArr.length > 1) {
        for (let i = 0; i < props.TypesOfFacilities[currentFacility].imgArr.length; i++) {
            const dot = document.createElement('span');
            dot.className = 'imgDot';
            if (i === 0) {
                dot.style.backgroundColor = '#333333';
            }
            document.getElementById("imgDots").appendChild(dot);
        }

        document.querySelectorAll('.imgArrow').forEach((arrow) => {
            arrow.style.display = 'block';
            arrow.addEventListener('click', moveImg);
        });
    } else {
        document.querySelectorAll('.imgArrow').forEach((arrow) => {
            arrow.style.display = 'none';
        });
    }

    document.getElementById('bigImgBtn').addEventListener('click', bigImg);
}

const moveImg = (event) => {
    if (event.currentTarget.id === 'arrowR') {
        currentImg++;
        if (currentImg > props.TypesOfFacilities[currentFacility].imgArr.length - 1) {
            currentImg = 0;
        }
    } else {
        currentImg--;
        if (currentImg < 0) {
            currentImg = props.TypesOfFacilities[currentFacility].imgArr.length - 1;
        }
    }

    document.getElementById('popUpImgContainer').style.backgroundImage = `URL(${props.TypesOfFacilities[currentFacility].imgArr[currentImg]}`;
    document.getElementById('imgBigImg').src = props.TypesOfFacilities[currentFacility].imgArr[currentImg];
    document.querySelectorAll('.imgDot').forEach((dot) => {
        dot.style.backgroundColor = '#f1f2f2';
    });
    let dotArr = document.getElementsByClassName('imgDot');
    dotArr[currentImg].style.backgroundColor = '#333333';
}

const bigImg = () => {
    if (!isImgBig) {
        document.getElementById('bigImgBtn').removeEventListener('click', bigImg);
        document.getElementById('bigImgBtn').style.backgroundImage = "url('assets/smallImgIcon.svg')";
        document.getElementById('popUpBigImg').style.display = 'block';
        document.getElementById('popUpBigImg').style.animation = 'popUpBigImgAnimation 1.5s ease';
        setTimeout(() => {
            document.getElementById('imgBigImg').style.opacity = '100%'
            document.getElementById('bigImgBtn').addEventListener('click', bigImg);
        }, 1500);
        isImgBig = true;

    } else {
        document.getElementById('bigImgBtn').removeEventListener('click', bigImg);
        document.getElementById('popUpBigImg').style.animation = 'popUpBigImgAnimationReverse 1.5s ease';
        document.getElementById('bigImgBtn').style.backgroundImage = "url('assets/bigImgIcon.svg')";
        document.getElementById('imgBigImg').style.opacity = '0%'
        setTimeout(() => {
            document.getElementById('bigImgBtn').addEventListener('click', bigImg);
            document.getElementById('popUpBigImg').style.display = 'none';
        }, 1500);
        isImgBig = false;
    }
}

const openFilter = (event) => {
    if (event.currentTarget.id.slice(6, 10) === 'Type') {
        if (!isFilterTypeOpen) {
            // document.getElementById('cards').style.top = '33vh';
            document.getElementById('filterOptionsType').style.display = 'flex';
            document.getElementById(event.currentTarget.id).style.backgroundColor = '#06838b';//אחרי האייקון לסובב 180 מעלות.
            isFilterTypeOpen = true;
            document.querySelectorAll('input').forEach((input) => {
                input.addEventListener('input', checkbox);
            });
        } else {
            if (!isFilterAreaOpen) {
                // document.getElementById('cards').style.top = '19vh';
            } else {
                // document.getElementById('cards').style.top = '29.5vh';
            }
            document.getElementById('filterOptionsType').style.display = 'none';
            document.getElementById(event.currentTarget.id).style.backgroundColor = '#015497';//אחרי האייקון לסובב 180 מעלות.
            isFilterTypeOpen = false;
        }
    } else {
        if (!isFilterAreaOpen) {
            if (!isFilterTypeOpen) {
                // document.getElementById('cards').style.top = '29.5vh';
            }
            document.getElementById('filterOptionsArea').style.display = 'flex';
            document.getElementById(event.currentTarget.id).style.backgroundColor = '#06838b';//אחרי האייקון לסובב 180 מעלות.
            isFilterAreaOpen = true;
            document.querySelectorAll('input').forEach((input) => {
                input.addEventListener('input', checkbox);
            });
        } else {
            if (!isFilterTypeOpen) {
                // document.getElementById('cards').style.top = '19vh';
            }
            document.getElementById('filterOptionsArea').style.display = 'none';
            document.getElementById(event.currentTarget.id).style.backgroundColor = '#015497';//אחרי האייקון לסובב 180 מעלות.

            isFilterAreaOpen = false;
        }
    }
}

const checkbox = (event) => {
    if (event.target.checked) {
        const filterTag = document.createElement('span');
        filterTag.className = 'filterTag';
        document.getElementById('filterTags').appendChild(filterTag);

        const tagClose = document.createElement('p');
        tagClose.className = 'tagClose';
        tagClose.innerHTML = '&times;';
        filterTag.appendChild(tagClose);
        tagClose.addEventListener('click', () => removeTag(event.target.id));

        const tagText = document.createElement('p');
        tagText.className = 'tagText';
        filterTag.appendChild(tagText);

        switch (event.target.id) {
            case ('mitvahimInput'):
                tagText.innerText = 'מטווחים';
                filterTag.id = 'mitvahimTag';
                filterTypeArr.push('מטווחים');
                break;
            case ('lashbitMeholotInput'):
                tagText.innerText = 'לש"בית מכולות';
                filterTag.id = 'lashbitMeholotTag';
                filterTypeArr.push("לש''בית מכולות");
                break;
            case ('lashbitEzInput'):
                tagText.innerText = 'לש"בית עץ';
                filterTag.id = 'lashbitEzTag';
                filterTypeArr.push("לש''בית עץ");
                break;
            case ('hederYeryInput'):
                tagText.innerText = 'חדר ירי';
                filterTag.id = 'hederYeryTag';
                filterTypeArr.push('חדר ירי');
                break;
            case ('zafonInput'):
                tagText.innerText = 'צפון';
                filterTag.id = 'zafonTag';
                filterAreaArr.push('צפון');
                break;
            case ('mercazInput'):
                tagText.innerText = 'מרכז';
                filterTag.id = 'mercazTag';
                filterAreaArr.push('מרכז');
                break;
            case ('daromInput'):
                tagText.innerText = 'דרום';
                filterTag.id = 'daromTag';
                filterAreaArr.push('דרום');
                break;
        }

        filtering(theData);
        addMarkers(theData);

    } else {
        removeTag(event.target.id);
    }
}

const removeTag = (id) => {
    document.getElementById(`${id.slice(0, -5)}Tag`).remove();
    document.getElementById(id).checked = false;

    switch (id) {
        case ('mitvahimInput'):
            for (let i = 0; i < filterTypeArr.length; i++) {
                if (filterTypeArr[i] === 'מטווחים') {
                    filterTypeArr.splice(i, 1);
                }
            }
            break;
        case ('lashbitMeholotInput'):
            for (let i = 0; i < filterTypeArr.length; i++) {
                if (filterTypeArr[i] === "לש''בית מכולות") {
                    filterTypeArr.splice(i, 1);
                }
            }
            break;
        case ('lashbitEzInput'):
            for (let i = 0; i < filterTypeArr.length; i++) {
                if (filterTypeArr[i] === "לש''בית עץ") {
                    filterTypeArr.splice(i, 1);
                }
            }
            break;
        case ('hederYeryInput'):
            for (let i = 0; i < filterTypeArr.length; i++) {
                if (filterTypeArr[i] === 'חדר ירי') {
                    filterTypeArr.splice(i, 1);
                }
            }
            break;
        case ('zafonInput'):
            for (let i = 0; i < filterAreaArr.length; i++) {
                if (filterAreaArr[i] === 'צפון') {
                    filterAreaArr.splice(i, 1);
                }
            }
            break;
        case ('mercazInput'):
            for (let i = 0; i < filterAreaArr.length; i++) {
                if (filterAreaArr[i] === 'מרכז') {
                    filterAreaArr.splice(i, 1);
                }
            }
            break;
        case ('daromInput'):
            for (let i = 0; i < filterAreaArr.length; i++) {
                if (filterAreaArr[i] === 'דרום') {
                    filterAreaArr.splice(i, 1);
                }
            }
            break;
    }

    filtering(theData);
    addMarkers(theData);
}

const searchInput = (event) => {
    console.log(event.target.value);//
    searching = event.target.value;
}