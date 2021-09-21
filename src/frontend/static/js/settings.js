var settingsPopup = document.getElementById('settings')
var settingsText = document.getElementById('settings-text')

$('#settings').hide()

settingsText.onclick = function () {
  settings()
}

function settings () {
  $('#settings').fadeIn(200)
}

function close_popup_box () {
  $('#settings').fadeOut(200)
}

window.onclick = function (event) {
  if (event.target == settingsPopup) {
    $('#settings').fadeOut(200)
  }
}

const lightSwitch = $('#light')
const darkSwitch = $('#dark')

function handleTheme () {
  if (lightSwitch.is(':checked')) {
    localStorage.setItem('theme', 'light')
    document.body.classList.add('light')
  } else {
    localStorage.setItem('theme', 'dark')
    document.body.classList.remove('light')
  }
}

function handleCredits () {
  if ($('#credits').is(':checked')) {
    localStorage.setItem('credits', 'true')
    $('#credits-footer').show()
  } else {
    localStorage.setItem('credits', 'false')
    $('#credits-footer').hide()
  }
}

function handleAlert () {
  if ($('#alert').is(':checked')) {
    localStorage.setItem('alert', 'true')
  } else {
    localStorage.setItem('alert', 'false')
  }
}

$('document').ready(function () {
  let theme = localStorage.getItem('theme')
  let credits = localStorage.getItem('credits')
  let alertOnLoad = localStorage.getItem('alert')

  if (!alertOnLoad) {
    localStorage.setItem('alert', 'true')
    alertOnLoad = 'true'
  }

  if (alertOnLoad === 'true') {
    $('#alert').prop('checked', true)
    

    //alert soon
  } else {
    $('#alert').prop('checked', false)
  }

  if (!credits) {
    localStorage.setItem('credits', 'true')
    credits = 'true'
  }

  if (credits === 'true') {
    $('#credits').prop('checked', true)
    $('#credits-footer').show()
  } else {
    $('#credits').prop('checked', false)
    $('#credits-footer').hide()
  }

  if (!theme) {
    localStorage.setItem('theme', 'dark')
    theme = 'dark'
  }

  if (theme === 'light') {
    lightSwitch.prop('checked', true)
    darkSwitch.prop('checked', false)
    document.body.classList.add('light')
  } else {
    lightSwitch.prop('checked', false)
    darkSwitch.prop('checked', true)
    document.body.classList.remove('light')
  }
})
