var loadingText = document.getElementById('loading-text')

if (window.location.href.indexOf('?err=') > -1) {
  var err = window.location.href.split('?err=')[1]
  err = decodeURI(err)
  loadingText.classList.add('error')
  loadingText.innerHTML = err
}

$(document).ready(function () {
  $('input[type="file"]').on('change', function (e) {
    fileUpload()
  })

  var fileInput = document.querySelector('label[for="upload"]')
  fileInput.ondragover = function () {
    this.className = 'upload-label changed'
    return false
  }
  fileInput.ondragleave = function () {
    this.className = 'upload-label'
    return false
  }
  fileInput.ondrop = function (e) {
    fileUpload()
  }

  async function fileUpload () {
    let error = false
    var file = $('input[type="file"]')[0].files[0]
    $('form').hide()
    $('.loading').show()

    if (!file) {
      $('form').show()
      $('.loading').hide()
      error = true
      loadingText.classList.add('error')
      return (loadingText.innerHTML = `File not uploaded, please upload a file`)
    }

    if (!file.type === 'application/x-zip-compressed') {
      $('form').show()
      $('.loading').hide()
      error = true
      loadingText.classList.add('error')
      return (loadingText.innerHTML = `File is not a zip file, please upload a zip file`)
    }

    loadingText.classList.remove('error')
    loadingText.innerHTML = `Loading File content..`

    var zip = new JSZip()
    await zip.loadAsync(file).then(
      async function (zip) {
        const requiredFiles = [
          'README.txt',
          'account/user.json',
          'messages/index.json',
          'servers/index.json'
        ]
        loadingText.innerHTML = `Checking for required files..`
        await new Promise(resolve => setTimeout(resolve, 2000))
        for (let i = 0; i < requiredFiles.length; i++) {
          if (!zip.files[requiredFiles[i]]) {
            error = true
            loadingText.classList.add('error')
            return (loadingText.innerHTML = `One of the file contents are missing. Please upload a valid file`)
          }
        }
        loadingText.classList.remove('error')
        loadingText.innerHTML = `Files found`
        await new Promise(resolve => setTimeout(resolve, 2000))
      },
      function () {
        loadingText.classList.add('error')
        loadingText.innerHTML = `File is not a zip file, please upload a zip file`
        error = true
      }
    )

    if (error) {
      $('form').show()
      $('.loading').hide()
      return
    }

    loadingText.classList.remove('error')
    loadingText.innerHTML = `Your statistics are being calculated. This might take 0 - 30 seconds.`
    $('form').submit()
    $('form').hide()
    $('.loading').show()
  }
})
