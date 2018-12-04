var rsc = (function(){
  var proxy = "https://cors-anywhere.herokuapp.com/",
      routes = {
	    version : "http://arkdedicated.com/version",
	    majorVersion : "http://arkdedicated.com/version/major",
	    serverStatus : "http://arkdedicated.com/officialserverstatus.ini",
	    news : "http://arkdedicated.com/news.ini",
	    hosts : "http://arkdedicated.com/officialservers.ini",
		serverQuery : "https://api.xcausxn.com/v1/game/"
      };
	  
   var utils = {	
     regex : {
		ip : /[\d]+\.[\d]+\.[\d]+\.[\d]+/g,
		newlines : /\r\n/g,
		tags : /<[^>]+>/g
	 }
	};
	  
  function getServerInfo(ip, config){
	var cfg = config || {
	  port : '27015',
      game : 'arkse'
	},
	queryRoute = routes.serverQuery + 
	             "?type=" + cfg.game + 
				 "&port=" + cfg.port +
				 "&host=" + ip;
	return ajax.get(queryRoute);
  }
  
  return {
    version: function(){ return ajax.get(proxy + routes.version);} ,
	majorVersion: function(){ return ajax.get(proxy + routes.majorVersion);},
	serverStatus: function(){ return ajax.get(proxy + routes.serverStatus);},
	news : function(){ return ajax.get(proxy + routes.news);},
	hosts: function(){ return ajax.get(proxy + routes.hosts);},
	serverInfo : getServerInfo,
	utils : utils
  };
})();

var oarrAdd = function(item){ 
  var idx = this().push(item) - 1;
  this.publish('change/add', { index : idx, value : item });
};

var model = (function(){ 
  var _ = new Observable({
  version : 0,
    news : "",
    serverStatus : "",
    servers : new Observe([]),
  });
  Object.defineProperty(_, 'majorVersion', {get(){ return parseInt(this.version).toFixed(0); }}); //Can only retrieve initial version of version otherwise, for some reason.
  _.servers.add = oarrAdd;   //Array.push/pop/shift/unshift doesn't trigger change
  
  return _;
})();



var Server = function(configuration = {}){
  if(!(this instanceof Server)){
    throw new Error("Server is a constructor and must be called with the new keyword.");
  }
  var setDefault = (val, defaultValue) => { return val === undefined ? defaultValue : val; }
  var query = {
	  address : configuration.hasOwnProperty("query") ? setDefault(configuration.query.address, null) : null,
	  port : configuration.hasOwnProperty("query") ? setDefault(configuration.query.port, null) : null,
	};
  
  this.name = setDefault(configuration.name, null);
  this.address = (query.address && query.port) ? (query.address + ":" + query.port) : null;
  this.map = setDefault(configuration.map, null);
  this.players = setDefault(configuration.players, []).map(x=> x.name);
  Object.defineProperty(this, 'playerCount', { get(){ return this.players.length; } });
  this.maxPlayers = setDefault(configuration.maxplayers, null);
  this.rules = (function(hasRules){
    return {
	  hasCharacterDownloads: hasRules ? setDefault( Boolean(parseInt( configuration.raw.rules.ALLOWDOWNLOADCHARS_i ))  ,null) : null, 	//Because boolean flags are such a great idea vs true/false
	  hasItemDownloads: 	 hasRules ? setDefault( Boolean(parseInt( configuration.raw.rules.ALLOWDOWNLOADITEMS_i )) ,null)  : null, 	//No really, boolean flags are the way of the future :/
	  hasPassword: 			 hasRules ? setDefault( configuration.raw.rules.ServerPassword_b ,null)                           : null, 	//But yeah, let's use true/false here because CONSISTENCY
	  clusterID: 			 hasRules ? setDefault( configuration.raw.rules.clusterID_s ,null)                                : null,  //s stands for string
	  time:                  hasRules ? setDefault( Number(configuration.raw.rules.DayTime_s) ,null)                          : null, 	//Because naturally numbers should be strings. Wait, Integers are a thing?
	  isLegacy:				 hasRules ? setDefault( Boolean(parseInt( configuration.raw.rules.LEGACY_i)) ,null)               : null, 	//Here I go flagging again!
	  timeout:               hasRules ? setDefault( null ,null)                                                               : null, 	//TODO: Figure out why I never assigned timeout
	  mods:                  hasRules ? setDefault( configuration.raw.rules.ModId_l ,null)                                    : null, 	//l? list? Hell if I know
	  isOfficial:            hasRules ? setDefault( Boolean(parseInt( configuration.raw.rules.OFFICIALSERVER_i)) ,null)       : null,	//Booooo, I'm a boooolean flag
	  hasBattleEye:          hasRules ? setDefault( configuration.raw.rules.SERVERUSESBATTLEYE_b ,null)                       : null,  //Aaaaand back to true/false. I'm so random <3
	  isPvE:                 hasRules ? setDefault( Boolean(parseInt( configuration.raw.rules.SESSIONISPVE_i)) ,null)         : null,  //One final flip-flop to flags <3 
	};
  })(configuration.hasOwnProperty("raw") && configuration.raw.hasOwnProperty("rules"));
}

var viewModel = (()=>{
  var _vm = new Observable({
    tabID : -1,
	serverID : 0,
	servers : new Observe([]),
	hosts : [],
  }),
	_hosts = [];
  
  //Filters - vm specific model data.
  //It's fine for props not to be observable, just have to be careful to explicitly set them
  var filters = new Observable({
    maps : [],
	modes : [],
	custom : "",
  });
  filters.update = (prop) => {
    var original = model.servers().slice();
	
	//There's a bug here. if e.g you select pve, then select -> deselect a map, then everything is removed
	if(filters.maps.length || filters.modes.length || filters.custom.trim().length){
      switch(prop){
	    case 'maps':
	      original = filters.maps.length ? original.filter((server) => filters.maps.includes(server.map)) : original;
		  break;
	    case 'modes':
	      var pveServers = (filters.modes.includes('pve')) ? original.filter((server) => { return Boolean(server.name.match(/pve/gi)) || !server.rules.isPvE; }) : [],
	  	    pvpServers = (filters.modes.includes('pvp')) ? original.filter((server) => { return Boolean(server.name.match(/pvp/gi)) || server.rules.isPvE; }) : [],
	  		notameServers = (filters.modes.includes('noTame')) ? original.filter((server) => server.name.includes("NoTaming")) : [];
	      var filteredServers = pveServers
	  						  .concat(pvpServers)
	  						  .concat(notameServers)
	  						  .reduce((list,item) => {
	  						    var serverIDs = list.map(server => server.name);
	  							if(!list.includes(item.name)){ list.push(item); }
	  							
	  							return list;
	  						  },[]);
	      var keys = filteredServers.map((server) => server.name); 
	  	original = filters.modes.length ? original.filter((server)=> keys.includes(server.name)) : original;
		  break;
	    case 'custom':
	      original = filters.custom.trim().length ? original.filter((server) => server.name.includes(filters.custom)) : original;
		  break;
	    default:
	      break;
	  }
	}
	//console.log('When filtered:', original);
	_vm.servers(original);
  };
  filters.test = (server) => {
    var hasAllowedMap = (filters.maps.length) ? filters.maps.includes(server.map) : true,
	    hasAllowedMode = (()=>{		  
		  var fPvP = false,
		      fPvE = false,
			  fNoT = false;
		  if(filters.modes.includes('pvp')){ fPvP = (server.rules.isPvE) ? !server.rules.isPvE : Boolean(server.name.match(/pvp/gi));}	  
		  if(filters.modes.includes('pve')){ fPvE = (server.rules.isPvE) ? server.rules.isPvE : Boolean(server.name.match(/pve/gi));}
		  if(filters.modes.includes('noTame')){ fNoT = server.name.includes('NoTaming'); }
		  
		  return (filters.modes.length) ? (fPvP || fPvE || fNoT) : true;
	})(),
	    hasAllowedCustom = (filters.custom.trim().length) ? server.name.includes(filter.custom) : true;
    return hasAllowedMap && hasAllowedMode && hasAllowedCustom;
  };
  
  //Model/VM Change events
  _vm.subscribe('change/tabID', (tabID) => vmEvents.displayTab(tabID.new));
  _vm.subscribe('change/serverID', (serverID) => vmEvents.displayServerInfo(serverID.new));
  _vm.servers.subscribe('change', (server) => vmEvents.addServersToList(server.new)); //{ old: [], new : [Server,Server,Server]}
  _vm.subscribe('change/hosts', (hosts) => vmEvents.queryServers(hosts.new));
  
  model.subscribe('change/version', (version) => vmEvents.updateVersion(version.new));
  model.subscribe('change/news', (news) => vmEvents.displayNews(news.new));
  model.subscribe('change/serverStatus', (serverStatus) => vmEvents.displayStatus(serverStatus.new));
  model.servers.subscribe('change/add', (server) => _vm.servers(_vm.servers().concat(server.value)));// model -> filter -> vm -> ui
  
  filters.subscribe('change/maps', (map) => filters.update('maps'));
  filters.subscribe('change/modes', (mode) => filters.update('modes'));
  filters.subscribe('change/custom', (custom) => filters.update('custom'));
  
  //UI events
  var changeTabIndex = function(){ _vm.tabID = this.dataset.index; };
  var setServerID = function(){ _vm.serverID = this.dataset.name; };
  //Map/Mode checkbox click events
      //Add map or filter out non-matches. Consider just setting filters to the map | mode?
  var mapFilter = function(){ filters.maps = (this.checked) ? filters.maps.concat(this.value) : filters.maps.filter(condition => condition != this.value); },
      //Add mode or filter out non-matches.
      modeFilter = function(){ filters.modes = (this.checked) ?  filters.modes.concat(this.value) : filters.modes.filter(condition => condition != this.value); };
  
  //DOM event binding
  Array.from(view.navItems).forEach((navItem) => navItem.onclick = changeTabIndex);  
  Array.from(view.filters.maps).forEach(x=> x.onclick = mapFilter);
  Array.from(view.filters.modes).forEach(x=> x.onclick = modeFilter);
  view.filters.custom.oninput = (e) => { filters.custom = e.target.value; };
   
   var sanitizer = {
     status : function(status){  
	   return status.split(rsc.utils.regex.newlines)//remove newlines and creates distinct entries
	                .filter(item => item.trim())    //removes empty entries created by split
	                .map(item => item.replace(rsc.utils.regex.tags, ""));//removes ark's custom xml markup
	 },
	 news : function(news){  //Honestly same as above but I don't trust the guys who manage the endpoint to be consistent. They've changed newlines to double spaces before :/
	   return news.split(rsc.utils.regex.newlines)
	                .filter(item => item.trim())
	                .map(item => item.replace(rsc.utils.regex.tags, ""));
	 },
   };
   
  //VM events
  var vmEvents = {
    updateVersion(version){
	  view.version.innerText = version;
	  view.majorVersion.innerText = parseInt(version).toFixed(0);
	},
    displayTab(tabID){
	  var tabs = Array.from(view.tabs),
	      selectedTab = tabs.find((tab)=> tab.dataset.index == tabID);
      if(selectedTab){
	    tabs.forEach((tab)=> tab.classList.add('hidden'));
	    selectedTab.classList.remove('hidden');
	  }	
	},
	//Tab 0
	displayStatus(status){
      var statuses = sanitizer.status(status);
	  addStatus = (statusItem) => { view.serverStatus.appendChild(createP(statusItem)); };
		
	  statuses.forEach(addStatus);
	},
	displayNews(news){
	  var newsItems = sanitizer.news(news),
      addNews = (newsItem) => { view.news.appendChild(createP(newsItem)); };

	  newsItems.forEach(addNews);
	},
	//Tab 1
    addServersToList(serverList){
      function addServerToList(server){
        if(filters.test(server)){ 
	      view.servers.appendChild(createLI(server));
	    }
	  }
      
      serverList.sort((a,b) => a.name.localeCompare(b.name,"en-US-u-kn-true"));
	  
      var currentList = Array.from(document.querySelectorAll('#hosts li')).map((li)=> li.dataset.name),
	      newList = serverList.map((server) => server.name);
	  		
	  var additions = newList.filter((id) => { return !currentList.includes(id) && filters.test(serverList.find((server) => server.name == id));}),
	      removals = currentList.filter((id) => !newList.includes(id));
	  	
	  var parent = view.servers;
	  
	  additions.forEach((id) => {
	    if(!parent.hasChildNodes()){ addServerToList( serverList.find((server) => server.name == id) ); }
	    else {
	      var idx = newList.indexOf(id),
	          prevElement = Array.from(parent.childNodes).find((element) => element.dataset.name == newList[idx - 1]);// doesn't work bc new list will have things in a different order
	    			
	      if(prevElement == null){ parent.insertBefore(createLI(serverList[idx]), parent.firstChild); }
	      else { parent.insertBefore(createLI(serverList[idx]), prevElement.nextSibling); }
	    }
	  });
	  removals.forEach((id)=> parent.removeChild(parent.querySelector(`li[data-name='${id}']`)));
    },
	queryServers(ipList){  	
	  document.querySelector(".loadingSpan").classList.add("loading");
	  loadServers();
    },
	//Tab 2
	displayServerInfo(serverID){
	  var server = model.servers().find((server) => server.name == serverID)
      if(server){  
	    console.log(server.players);
	    Object.keys(server).forEach((key) => {  
	      function mapData(prop, data){
		    try {
	          document.querySelector(`[data-prop='${prop}']`).innerText = data;	  
			} catch(err){console.log(prop); }
	      }
	      if(key === 'rules'){
	        Object.keys((server.rules)).forEach((rule) => { mapData(rule, server.rules[rule]); });
	      } else {
	        mapData(key, server[key]);
	      }
	    });
	  	  
	    _vm.tabID = 2;
	  } else {
	    throw new Error("Server not found.");
	  }
	},
  };  
  
  //Utility
  var createLI = (server) => {
    var li = document.createElement('li');
	li.onclick = setServerID;
	li.innerText = server.name;
	li.dataset.name = server.name;
	
	return li;
  };
  var createP = (description) => {
    var p = document.createElement("p");
	p.innerText = description;
	return p;
  };
  
  var loadServers = () => {
    if(!_vm.hosts.length){
	  view.loadingSpan.classList.remove('loading');
	  view.loadingSpan.classList.add('done');
	  return;
	}
	var ip = _vm.hosts.shift();
	rsc.serverInfo(ip).then(x=>{
	  model.servers.add(new Server(x.value));
	})
	.catch((err)=>{  }) //Any kind of miscellaneous error could have occurred. Usually times out internally though. (408 Request Timeout)
	.then(()=> loadServers()); //Recurse
  };
  
  _vm.tabID = 0;
  
  return _vm;
})();  
  function promiseTimer(promise, ms, message){ 
    var timeout = new Promise((resolve,reject) => {
		var id = setTimeout(()=> { 
			clearTimeout(id);
			reject(message || 'Timed out. ');
		},ms); 
	}); 
	
	return Promise.race([promise,timeout]);
 }
  //VERSION/MAJOR VERSION: There's a seperate resource for major version, but I don't see the need to get both.
  //promiseTimer(rsc.majorVersion(), 60000, "Major version info failed to load.").then(x=>{}).catch(x=> {console.log(x); vm.majVersion.ui.innerText = "unavailable"; });
  promiseTimer(rsc.version(), 60000, "Version info failed to load.")
	.then(x=> model.version = x.value)
	.catch(x=> {
	  document.querySelector('#version').innerText = "unavailable";
	  document.querySelector('#majorVersion').innerText = "unavailable";
	});
  //SERVER STATUS
  promiseTimer(rsc.serverStatus(), 60000, "Server status failed to load.")
    .then(x=> model.serverStatus = x.value )
    .catch(x=> {console.log(x); model.serverStatus = "Server status unavailable."; });	
  //NEWS
  promiseTimer(rsc.news(), 60000, "News failed to load.")
	.then(x=> model.news = x.value )
	.catch(y=> {console.log(y); model.news = "Unavailable." });	
  //HOSTS
  promiseTimer(rsc.hosts(), 60000, "Host list failed to load.").then(x=> {
	  viewModel.hosts = x.value.split(rsc.utils.regex.newlines).reduce((y,z) => {
	    var ip = z.match(rsc.utils.regex.ip);
		if(ip){ y.push(z.match(rsc.utils.regex.ip)[0]); }
		return y;
	  }, []);
  }).catch(a=> {console.log(a); alert("Server list unavailable."); });	