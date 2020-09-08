function rasterize_img(image_data_source, image_data_destination) {
    const bufferPointerIn = Module._malloc(image_data_source.width * image_data_source.height * 4);
    const bufferPointerOut = Module._malloc(image_data_destination.width * image_data_destination.height * 4);
    const bufferIn = new Uint8Array(Module.HEAPU8.buffer, bufferPointerIn, image_data_source.width * image_data_source.height * 4);    
    bufferIn.set(image_data_source.data);
    
    let max_val = Number($('#max_val_slider').val())/100.0;
    let marker_size = (Number($('#marker_size_slider').val())/100.0)*20;
    
    wasmModule._rasterize_img_tiled_uint8(bufferPointerIn, image_data_source.height, image_data_source.width, bufferPointerOut, image_data_destination.height, image_data_destination.width, max_val, marker_size, 80, 40);
    
    const bufferOut = new Uint8Array(Module.HEAPU8.buffer, bufferPointerOut, image_data_destination.width * image_data_destination.height * 4);
    image_data_destination.data.set(bufferOut);
    Module._free(bufferPointerIn);
    Module._free(bufferPointerOut);
}

function renderSource(source, destination) {
    const context_source = source.getContext('2d');
    const context_destination = destination.getContext('2d');

    const image_data_source = context_source.getImageData(0, 0, source.width, source.height);
    const image_data_destination = context_destination.getImageData(0, 0, destination.width, destination.height);

    console.time('rasterize_img')
    rasterize_img(image_data_source, image_data_destination);
    console.timeEnd('rasterize_img')

    context_destination.putImageData(image_data_destination, 0, 0);
}


wasmModule = Module;
var imageCapture;
const canvas_input = document.createElement('canvas');
const loading_modal = $("#loading");

var camera_id = 0;

function getCameraStream(switch_camera=false) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
    var cfg_provider = new Promise(function(resolve, reject){
      return resolve({video: true});
    });

  } else {
    var cfg_provider = navigator.mediaDevices.enumerateDevices().then(el => el.filter(dev => dev.kind == "videoinput")).then(
      cams =>{
        if(cams.length > 1) {
          if(switch_camera){
            camera_id = (camera_id + 1) % cams.length;
          }
          var media_cfg = {video: {'deviceId':cams[camera_id].deviceId}};
        } else {
          var media_cfg = {video: true};
        }
        return media_cfg;
      }
    );
  }
  

  cfg_provider.then(cfg => {
    navigator.mediaDevices.getUserMedia(cfg)
  .then(mediaStream => {
    video = document.querySelector('video');
    video.srcObject = mediaStream;
    
    if(typeof ImageCapture != "undefined"){
      let video_tracks = mediaStream.getVideoTracks();
      const track = video_tracks[0];
      imageCapture = new ImageCapture(track);
    } else {
      imageCapture = {};
      imageCapture.takePhoto = function() {
        return new Promise(function(resolve, reject){
          return resolve(video);
        });
      };
    }
    
  })
  .catch(
      error => {
        showFileInput();
        console.log(error);
        if(error.name == "NotAllowedError") {
          alert('Webcam access is required!');
        }
        if(error.name == "NotFoundError") {
          alert('No webcam found!');
        }
        
        
      }
    );
  }
  );
}





function hideLoadingModal(_){
  loading_modal.modal('hide');
}

function showLoadingModal(){
  $('#loading').find('#staticBackdropLabel').text('Loading (can take up to 60 sconds)');
  loading_modal.modal('show');
}


function hideModal(){
  loading_modal.modal('hide');
}
function showDownloadModal(){
  $('#loading').find('#staticBackdropLabel').text('Preparing Download');
  loading_modal.modal('show');
}

function processImage(imageBitmap) {
  if(true){
    switch($('input[name="select_size"]:checked').val()){
      case 'S':
        var width = 256*2;
        break;
      case 'M':
        var width = 256*3;
        break;
      case 'L':
        var width = 256*4;
        break;
      case 'XL':
        var width = 256*5;
        break
    }
    //var width = 256*4;
    var height = imageBitmap.height * (width / imageBitmap.width);
  } else {
    var height = 256*4;
    var width = imageBitmap.width * (height / imageBitmap.height);
  }
  canvas_input.height = height;
  canvas_input.width = width;

  var f = 3;
  canvas_output = document.createElement('canvas')
  canvas_output.height = height*f;
  canvas_output.width = width*f;

  const context = canvas_input.getContext('2d');
  context.drawImage(imageBitmap, 0, 0, canvas_input.width, canvas_input.height);

  renderSource(canvas_input, canvas_output);

  canvas_output = $(canvas_output).addClass("card-img-top");

  let img_card = $(`
    <div class="row"> 
      <div class="col-md-12"> 
        <div class="card">
          <div class="card-body">
            <a class="btn btn-success btn-download">Download</a>
          </div>
        </div>
      </div>
    </div>
  `);
  
  img_card.find(".card").prepend(canvas_output);
  let button = img_card.find(".btn-download")[0];

  button.addEventListener('click', function (e) {
    showDownloadModal();
    canvas_output[0].toBlob(
      blob => {
        const anchor = document.createElement('a');
        let ts = new Date().toISOString().replace(/-/g, '_').replace(/ /g, '_').replace(/\./g, '_').replace(/:/g, '_').replace(/T/g, '_').slice(0,-5);
        anchor.download = ts + '.png'; // optional, but you can give the file a name
        anchor.href = URL.createObjectURL(blob);
    
        anchor.click(); //
    
        URL.revokeObjectURL(anchor.href); // remove it from memory and save on memory!
        hideModal();
      },
      'image/png',
      0.9,
    );
  });
  

  $("#image_container").append(img_card); //.prepend($('<li class="list-group-item"></li>')

  loading_modal.on("shown.bs.modal", hideLoadingModal);
  loading_modal.on("hidden.bs.modal", _ => loading_modal.unbind("shown.bs.modal", hideLoadingModal));
  
  hideLoadingModal();
}


function onTakePhotoButtonClick() {
    const cfg = {imageHeight:1080,imageWidth:1920 };

  showLoadingModal();
  imageCapture.takePhoto()
  .then(blob => createImageBitmap(blob))
  .then(imageBitmap => {
    processImage(imageBitmap);
  })
  .catch(error => console.log(error)); 
}



function showFileInput(){
  $("#file_input").show();
  $("#camera_input").hide();
  $("#file_input_nav").addClass("active");
  $("#camera_input_nav").removeClass("active");
}

function showCameraInput(){
  getCameraStream();
  $("#file_input").hide();
  $("#camera_input").show();
  $("#file_input_nav").removeClass("active");
  $("#camera_input_nav").addClass("active");
}

function handleImage(e){
    showLoadingModal();
    var reader = new FileReader();
    reader.onload = function(event){
        var img = new Image();
        img.onload = function(){
          processImage(img);
        }
        img.src = event.target.result;
    }
    reader.readAsDataURL(e.target.files[0]);     
}


var CLIPBOARD = new CLIPBOARD_CLASS();

/**
 * image pasting into canvas
 * 
 * @param {string} canvas_id - canvas id
 * @param {boolean} autoresize - if canvas will be resized
 */
function CLIPBOARD_CLASS() {
	var _self = this;
	//handlers
	document.addEventListener('paste', function (e) { _self.paste_auto(e); }, false);

	//on paste
	this.paste_auto = function (e) {
		if (e.clipboardData) {
			var items = e.clipboardData.items;
			if (!items) return;
			
			//access data directly
			var is_image = false;
			for (var i = 0; i < items.length; i++) {
				if (items[i].type.indexOf("image") !== -1) {
					//image
					var blob = items[i].getAsFile();
					var URLObj = window.URL || window.webkitURL;
					var source = URLObj.createObjectURL(blob);
					this.paste_createImage(source);
					is_image = true;
				}
			}
			if(is_image == true){
				e.preventDefault();
			}
		}
	};
	//draw pasted image to canvas
	this.paste_createImage = function (source) {
    showLoadingModal();
		var pastedImage = new Image();
		pastedImage.onload = function () {
			processImage(pastedImage);
		};
		pastedImage.src = source;
	};
}




//var imageLoader = document.getElementById('imageLoader');
var imageLoader = document.getElementById('imageLoader');
imageLoader.addEventListener('change', handleImage, false);



showFileInput();


