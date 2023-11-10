$ASSETSFOLDER = "assets\timeline"

# Get all .mp4 files in the specified folder
$mediaFiles = Get-ChildItem -Path $ASSETSFOLDER -Filter *.mp4

# Iterate through each .mp4 file
foreach ($mediaFile in $mediaFiles) {
    $FILENAME = $mediaFile.BaseName -replace '-1920X1080', ''
    $INPUT = Join-Path -Path $ASSETSFOLDER -ChildPath $mediaFile.Name
    $FOLDER_TARGET = Join-Path -Path $ASSETSFOLDER -ChildPath $FILENAME

    New-Item -ItemType Directory -Force -Path $FOLDER_TARGET | Out-Null

    $OUTPUT = Join-Path -Path $ASSETSFOLDER -ChildPath "$FILENAME\$FILENAME"
    $DURATION = ffprobe -i $INPUT -show_format -v quiet | Select-String -Pattern 'duration=' | ForEach-Object { $_.Line -replace 'duration=' }

    $OUTPUT720 = "$OUTPUT-$DURATION-720"
    $OUTPUT360 = "$OUTPUT-$DURATION-360"
    $OUTPUT144 = "$OUTPUT-$DURATION-144"

    # Use ffmpeg to render in other resolutions
    Write-Output "Rendering $FILENAME in 720p"
    & ffmpeg -y -i $INPUT `
        -c:a aac -ac 2 `
        -vcodec h264 -acodec aac `
        -ab 128k `
        -movflags frag_keyframe+empty_moov+default_base_moof `
        -b:v 1500k `
        -maxrate 1500k `
        -bufsize 1000k `
        -vf "scale=-1:720" `
        -v quiet `
        "$OUTPUT720.mp4"

    Write-Output "Rendering $FILENAME in 360p"
    & ffmpeg -y -i $INPUT `
        -c:a aac -ac 2 `
        -vcodec h264 -acodec aac `
        -ab 128k `
        -movflags frag_keyframe+empty_moov+default_base_moof `
        -b:v 400k `
        -maxrate 400k `
        -bufsize 400k `
        -vf "scale=-1:360" `
        -v quiet `
        "$OUTPUT360.mp4"

    Write-Output "Rendering $FILENAME in 144p"
    & ffmpeg -y -i $INPUT `
        -c:a aac -ac 2 `
        -vcodec h264 -acodec aac `
        -ab 128k `
        -movflags frag_keyframe+empty_moov+default_base_moof `
        -b:v 300k `
        -maxrate 300k `
        -bufsize 300k `
        -vf "scale=256:144" `
        -v quiet `
        "$OUTPUT144.mp4"
}