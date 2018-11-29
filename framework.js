var d = (function(){
  var functionMap = Object.create(null);
  
  function defineFunction(name,func){
    if(name == null){ throw new Error("Function name required"); }
	else if(typeof name != "string"){ throw new Error("Function name must be a string."); }
	else if(func != null && typeof func != "function"){ throw new Error("Function must be of type function if supplied"); }
	
	functionMap[name] = func;
  }
  
  function requireFunction(name){
    if(typeof name != "string"){ throw new Error("Function name required"); }
    return functionMap[name] !== undefined ? functionMap[name] : null;
  }
  
  return {
    define : defineFunction,
	require: requireFunction,
  };
})();

var d_tests = (function(){
  function testDefineBadName(){}
  function testDefineNoFunc(){}
  function testRequireNoName(){}
  function testRequireNoFunc(){}
  
  return { 
    execute : function(){
      testDefineBadName();
      testDefineNoFunc();
      testRequireNoName();
	  testRequireNoFunc();
	}
  };
})();

var ajax = (()=>{
  var tryParseJSON = function(input){ 
    try{ return JSON.parse(input);}
	catch{ return input; }
  };

  //Todo: refactor into something that accepts an ajax options object.
  // send = (method,url,data,headers,async)
  var send = (method,url) => { 
    var STATUS_CODE = {
	  OK : 200,
	  MULTIPLE_CHOICES : 300,
	};
  
    return new Promise((resolve, reject) => {
	  var xhr = new XMLHttpRequest();
	  xhr.onload = function(){
	      var response = {
		    status : {
			  code : xhr.status,
			  text : xhr.statusText,
			},
			value : tryParseJSON(xhr.response),
		  };
		  
		  if(this.status >= STATUS_CODE.OK && this.status < STATUS_CODE.MULTIPLE_CHOICES){ resolve(response); } 
		  else { reject(response); }
	  };
	  xhr.onerror = function(){
		var response = {
		    status : {
			  code : xhr.status,
			  text : xhr.statusText,
			},
			value : tryParseJSON(xhr.response),
		  };
		reject(response);
	  };
	  xhr.open(method,url);
	  //if(headers && Array.isArray(headers)){ headers.forEach(x=> xhr.setRequestHeader(x.header,x.value)); }
	  xhr.send();//accepts data, optionally
	});
  };
  
  return {
    get : function(url){ return send("GET",url); },
	//put(url,data) { return send("PUT",url); },
	//post: function(url,data,headers){ return send("POST",url,data,headers); }
	//'delete' : (url) => { return send("DELETE",url); }
  };
})();

function Publisher(){
  if(!(this instanceof Publisher)){
    throw new Error('Publisher is a constructor and must be called with the new keyword.');
  }
  
  var eventMap = {};
  
  var subscribeToEvent = (name, subscriber) => {
    if(name == null){ throw new Error('Event must be specified.'); }
	else if(subscriber == null) { throw new Error('Subscription function must be specified.'); }
	else if(typeof name != "string"){ throw new TypeError('Event must be a string.'); }
	else if(typeof subscriber != 'function'){ throw new TypeError('Subscriber must be of type function.'); }
	
	if(eventMap[name] == null){ 
	  eventMap[name] = []; 
	}
	
	var index = eventMap[name].push(subscriber) - 1;
	return { index : index };		
  }
  
  var unsubscribeFromEvent = (name, index) => {
    if(name == null){ throw new Error("Event must be specified"); }
    else if(typeof name != "string"){ throw new Error("Event must be a string");}
	else if(typeof index != "number" || !isFinite(index) || index < 0){ throw new Error("Index must be a finite, positive number"); };
    
    if(eventMap[name] == null){ throw new Error("Event does not exist"); }
	if(eventMap[name].length <= index){ throw new Error("Index out of range"); }
     
	delete eventMap[name][index];
  }
  
  function publishEventInfo(name, info){
    if(name == null){ throw new Error('Action event must be specified.'); }
	else if(typeof name != "string"){ throw new TypeError('Action event must be a string.'); }
	
    if(eventMap[name] != null){
	  eventMap[name].forEach((subscriber)=> subscriber(info) );
	}
  }
  
  this.subscribe = subscribeToEvent;
  this.unsubscribe = unsubscribeFromEvent;
  this.publish = publishEventInfo;
}

function Observable(subject){
  if(!(this instanceof Observable)){
    throw new Error('Observable is a constructor and must be called with the new keyword.');
  }
  
  var publisher = new Publisher();

  var setPrivateValue = (property, value) => {
    this['_' + property] = value;
  }
  var getPrivateValue = (property) => {
    return this['_' + property];
  }
  
  var externalInterface = {};
  Object.keys(subject).forEach((key)=>{
    setPrivateValue(key, subject[key]);
	externalInterface[key] = {
	  get(){ return getPrivateValue(key); },
	  set(value){
	    var oldValue = getPrivateValue(key);
	    if(oldValue != value){
		  var args = {
		    'old' : oldValue,
			'new' : value,
		  };
		  setPrivateValue(key, value);
		  publisher.publish("change/" + key, args);
		  publisher.publish('change', args);
		}
	  }
	};
  });
  
  return Object.create(publisher, externalInterface);
}
function Observe(primitive){
  if(!(this instanceof Observe)){
	throw new Error('Observe is a constructor and must be called with the new keyword.');
  }
  var _primitive = primitive,
	  publisher = new Publisher();
	  
  var observe = (val) => {
    if(val !== undefined && val !== _primitive){
	  publisher.publish('change', {
	    'old' : _primitive,
		'new' : val,
	  });
	  _primitive = val;
	} else {
	  return _primitive;
	}
  };
  
  observe.subscribe = publisher.subscribe;
  observe.publish = publisher.publish;
  observe._set = (val) => { _primitive = val; };
  
  return observe;
}