var YouTube = require('youtube-node');
var YAML = require('yamljs');
var request = require('request');

var CHANNEL_ID = 'UCExDf4hkbSU-pmJcyT_sDtg';
var YOUTUBE_KEY = 'AIzaSyD8F5XTORodGF6CdIVhRLx5mWEtg8w3gPc';

//var CATEGORY_ID = '12';//隨意測試區
//var GET_URI = 'https://talk.pdis.nat.gov.tw/c/12.json';//隨意測試區
var CATEGORY_ID = '13';//pdis-site/how-we-work-track
var GET_URI = 'https://talk.pdis.nat.gov.tw/c/6/13.json';//pdis-site/how-we-work-track
var POST_URI = 'https://talk.pdis.nat.gov.tw/posts';
var TOPIC_URI = 'https://talk.pdis.nat.gov.tw/t/';
var YOUTUBE_URI = "https://www.youtube.com/watch?v=";
var TAGNAME = 'Youtube';
var API_KEY = '7af653838dfd6e9f1ed9b25bb447f298b5e855b48dbf22ead2abf5bd74d19576';
var API_NAME = 'youtube2discourse';

//Set the headers
var headers = {
    'User-Agent': 'Super Agent/0.0.1',
    'Content-Type': 'application/x-www-form-urlencoded'
}
var topic_ary = [];
var topic_obj = [];
var opts = {
    url: GET_URI,
    method: 'GET',
    headers: headers,
    form: {
		'api_key': API_KEY,
		'api_username': API_NAME
	}
}
//取得討論分類內已有的文章列表
request(opts, function (error, response, results) {
    if (!error && response.statusCode == 200) {
		var res = JSON.parse(results);
        //console.log(res);
		for (var i = 0; i < res.topic_list.topics.length; i++) {
			var title = res.topic_list.topics[i].title;
			var chk = title.lastIndexOf('-');
			if(chk > -1){
				title = title.substring(chk+3, title.length);
			}
			var id = res.topic_list.topics[i].id;
			topic_ary.push(title.toUpperCase());
			topic_obj[title.toUpperCase()] = id;
			//console.log(res.topic_list.topics[i]);
		}
		console.log(topic_obj);
		postTo();
    }else{
		console.log('error='+error+' '+response.statusCode);
	}
})
//介接與發文
function postTo(){
	//取得頻道內所有的影片列表
	var youTube = new YouTube();
	youTube.setKey(YOUTUBE_KEY);
	youTube.getChannelById(CHANNEL_ID, function(error, results) {
		if (error) {
			console.log(error);
		}else {
		//console.log(JSON.stringify(results, null, 2));
		//取得頻道內所有影片資訊
		for(var i in results.items) {
			var item = results.items[i];
			var playlistId = item.contentDetails.relatedPlaylists.uploads;
			for (var i = 0; i < results.items.length; i++) {
				yt1 = new YouTube();
				yt1.setKey(YOUTUBE_KEY);
				yt1.getPlayListsItemsById(playlistId, function(error, result) {
					if (error) {
						console.log(error);
					}else {
						//console.log(JSON.stringify(result, null, 2));
						//取得單一影片資訊
						for (var j = 0; j < result.items.length; j++) {
							var playlistItem = result.items[j];
							var videoId = playlistItem.snippet.resourceId.videoId;
							yt2 = new YouTube();
							yt2.setKey(YOUTUBE_KEY);
							yt2.getById(videoId, function(error, result) {
								if (error) {
									console.log(error);
								}else {
									//console.log(JSON.stringify(result, null, 2));
									var id = result.items[0].id;
									var date = result.items[0].snippet.publishedAt;
									var title = result.items[0].snippet.title;
									var desc = result.items[0].snippet.description;
									date = date.substring(0, date.indexOf('T'));
									var chk = title.lastIndexOf('-');
									//檢查標題是否含有日期，有就取用標題日期
									if(chk > -1){
										date = title.substring(0, title.indexOf(' '));
										title = title.substring(title.indexOf(' ')+1, title.length);
									}
									console.log(id+" "+date+" "+title);
									//檢查影片是否已存在要介接的討論區，沒有就介接並發文
									if(!inArray(title.toUpperCase(), topic_ary)){
										// Configure the request
										var options = {
											url: POST_URI,
											method: 'POST',
											headers: headers,
											form: {
												'title': title,
												'created_at': date,
												'raw': setContent(id),
												'category': CATEGORY_ID,
												'api_key': API_KEY,
												'api_username': API_NAME
											}
										}
										// Start the request
										request(options, function (error, response, body) {
											console.log('post new '+title);
											if (!error && response.statusCode == 200) {
												// Print out the response body
												console.log(body)
											}else{
												console.log('error='+error+' '+response.statusCode);
											}
										})
									}else{
										//已存在文章檢查是否需要更新
										var tid = topic_obj[title.toUpperCase()];
										console.log('repeat: '+tid);
										var options = {
											url: TOPIC_URI+tid+'.json?include_raw=1',
											method: 'GET',
											headers: headers,
											form: {
												'api_key': API_KEY,
												'api_username': API_NAME
											}
										}
										// Start the request
										request(options, function (error, response, result) {
											console.log('get topic');
											if (!error && response.statusCode == 200) {
												var res = JSON.parse(result);
												var raw = YAML.parse(res.post_stream.posts[0].raw);
												var stream_id = res.post_stream.stream[0];
												var hasTag = -1;	//是否有youtube標籤
												var needUpldae = 0;	//是否需要更新
												console.log("length="+raw.content.length);
												for(var i=0;i<raw.content.length;i++){
													for(var v in raw.content[i]){
														if(v==TAGNAME) hasTag = i;
													}
												}
												if(hasTag >=0){
													if(raw.content[hasTag].youtube==undefined || raw.content[hasTag].youtube==""){
														raw.content[hasTag].youtube = YOUTUBE_URI+id;
														raw.date = date;
														var yaml = obj2yaml(raw);
														needUpldae = 1;
													}
												}else{
													var tmp = {};
													tmp[TAGNAME] = YOUTUBE_URI+id;
													raw.content.push(tmp);
													//raw.date = date;
													var yaml = obj2yaml(raw);
													needUpldae = 1;
												}
												if(needUpldae){
													console.log(POST_URI+'/'+stream_id);
													var options = {
													url: POST_URI+'/'+stream_id,
													method: 'PUT',
													headers: headers,
													form: {
														'post[raw]': yaml,
														'api_key': API_KEY,
														'api_username': API_NAME
													}
												}
												// Start the request
												request(options, function (error, response, body) {
													console.log('update old');
													if (!error && response.statusCode == 200) {
														// Print out the response body
														console.log(body)
													}else{
														console.log('error='+error+' '+response.statusCode);
													}
												})
												}
											}else{
												console.log('error='+error+' '+response.statusCode);
											}
										})
									}
								}
							});
							//break;
						}
					}
				});
			}
		}
	  }
	});
}
//產生文章內容
function setContent(id){
	var obj = {};
	var obj2 = {};
	var ary = [];
	
	obj2["youtube"] = YOUTUBE_URI+id;
	ary.push(obj2);
	obj["content"] = ary;
	//var json = JSON.stringify(obj);
	var yaml = obj2yaml(obj);
	//console.log(json);
	console.log(yaml);
	return yaml;
}
//是否在陣列內
function inArray(str, ary) {
    var length = ary.length;
    for(var i = 0; i < length; i++) {
        if(ary[i] == str) return true;
    }
    return false;
}
//物件轉yaml，刪除不要的'{}
function obj2yaml(str){
	var yaml = YAML.stringify(str);
	yaml = yaml.replace(/[\'\{\}]/g, "");
	return yaml;
}
// parse a date in yyyy-mm-dd format
function parseDate(input) {
  var parts = input.split('-');
  // new Date(year, month [, day [, hours[, minutes[, seconds[, ms]]]]])
  return new Date(parts[0], parts[1]-1, parts[2]); // Note: months are 0-based
}
