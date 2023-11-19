class VideoPlayer {
  constructor({ manifestJSON, network, videoComponent }) {
    this.manifestJSON = manifestJSON
    this.network = network
    this.videoComponent = videoComponent
    this.videoElement = null
    this.sourceBuffer = null
    this.activeItem = {}
    this.selected = {}
    this.videoDuration = 0
    this.selections = []
  }

  initializeCodec() {
    this.videoElement = document.getElementById('vid')
    const mediaSourceSupported = !!window.MediaSource
    if (!mediaSourceSupported) {
      alert('Your browser or system does not support MSE!')
      return
    }

    const codecSupported = MediaSource.isTypeSupported(this.manifestJSON.codec)
    if (!codecSupported) {
      alert(`Your browser does not support the media codec: ${this.manifestJSON.codec}`)
      return
    }

    const mediaSource = new MediaSource()
    this.videoElement.src = URL.createObjectURL(mediaSource)

    mediaSource.addEventListener('sourceopen', this.sourceOpenWrapper(mediaSource))
  }

  sourceOpenWrapper(mediaSource) {
    return async(_) => {
      this.sourceBuffer = mediaSource.addSourceBuffer(this.manifestJSON.codec)
      const selected = this.selected = this.manifestJSON.intro
      mediaSource.duration = this.videoDuration //avoid displaying duration as LIVE
      await this.fileDowload(selected.url)
      setInterval(this.waitForQuestions.bind(this), 200)
    }
  }

  waitForQuestions() {
    const currentTime = parseInt(this.videoElement.currentTime)
    const option = this.selected.at === currentTime
    if (!option) return;
    // avoid modal opening twice at same second
    if (this.activeItem.url === this.selected.url) return;
    this.videoComponent.configureModal(this.selected.options)
    this.activeItem = this.selected
  }

  async currentFileResolution() {
    const LOWEST_RESOLUTION = 144
    const prepareUrl = {
      url: this.manifestJSON.finalizar.url,
      fileResolution: LOWEST_RESOLUTION,
      fileResolutionTag: this.manifestJSON.fileResolutionTag,
      hostTag: this.manifestJSON.hostTag
    }
    const url = this.network.parseManifestUrl(prepareUrl)
    return this.network.getProperResolution(url)
  }

  async nextChunk(data) {
    const key = data.toLowerCase()
    const selected = this.manifestJSON[key]
    this.selected = {
      ...selected,
      // set the time to display modal dialog based on current time
      at: parseInt(this.videoElement.currentTime + selected.at)
    }
    this.manageLag(this.selected)
    // keep on playing the video while downloading next
    this.videoElement.play()
    await this.fileDowload(selected.url)
  }

  manageLag(selected) {
    if (!!~this.selections.indexOf(selected.url)) {
      selected.at += 5
      return;
    }
    this.selections.push(selected.url)
  }

  async fileDowload(url) {
    const fileResolution = await this.currentFileResolution()
    console.log('currentResolution', fileResolution)
    const prepareUrl = {
      url,
      fileResolution,
      fileResolutionTag: this.manifestJSON.fileResolutionTag,
      hostTag: this.manifestJSON.hostTag
    }
    const finalUrl = this.network.parseManifestUrl(prepareUrl)
    this.setVideoPlayerDuration(finalUrl)
    const data = await this.network.fetchFile(finalUrl)
    return this.processBufferSegments(data)
  }

  setVideoPlayerDuration(finalURL) {
    const bars = finalURL.split('/')
    const [ name, videoDuration ] = bars[bars.length - 1].split('-')
    this.videoDuration += parseFloat(videoDuration)
  }

  async processBufferSegments(allSegments) {
    const sourceBuffer = this.sourceBuffer
    sourceBuffer.appendBuffer(allSegments)
    return new Promise((resolve, reject) => {
      const updateEnd = (_) => {
        sourceBuffer.removeEventListener('updateend', updateEnd)
        sourceBuffer.timestampOffset = this.videoDuration
        return resolve()
      }
      sourceBuffer.addEventListener('updateend', updateEnd)
      sourceBuffer.addEventListener('error', reject)
    })
  }
}