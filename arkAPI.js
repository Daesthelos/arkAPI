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

var model = new Observable({
  version : 0,
  news : "",
  serverStatus : "",
  servers : new Observe([]),
});
Object.defineProperty(model, 'majorVersion', {get(){ return parseInt(this.version).toFixed(0); }}); //Can only retrieve initial version of version otherwise, for some reason.
//Array.push/pop/shift/unshift doesn't trigger change
model.servers.add = oarrAdd;

var _Server = function(configuration = {}){
  if(!(this instanceof _Server)){
    throw new Error("Server is a constructor and must be called with the new keyword.");
  }
  var setDefault = (val, defaultValue) => { return val === undefined ? defaultValue : val; }
  var query = (function(hasConfig){
    return {
	  address : hasConfig ? setDefault(configuration.query.address, null) : null,
	  port : hasConfig ? setDefault(configuration.query.port, null) : null,
	};
  })(configuration.hasOwnProperty("query"));
  
  
  this.name = setDefault(configuration.name, null);
  this.address = (query.address && query.port) ? (query.address + ":" + port) : null;
  this.map = setDefault(configuration.map, null);
  this.players = setDefault(configuration.players, []);
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

var view = (function(){
  var ui = {
    navItems : document.querySelectorAll('.nav-item[data-index]'),
	tabs : document.querySelectorAll('.tab[data-index]'),
	version : document.querySelector('#version'),
	majorVersion : document.querySelector('#majorVersion'),
	serverStatus : document.querySelector('#serverStatus'),
	news : document.querySelector('#news'),
	loadingSpan : document.querySelector(".loadingSpan"),
	servers: document.querySelector('#hosts'),
	filters : {
	  maps : document.querySelectorAll('#maps input[type="checkbox"]'),
	  modes: document.querySelectorAll('#gameModes input[type="checkbox"]'),
	  custom: document.querySelector('#txtFind'),
	},
	serverInfo : {
	  name : document.querySelector('#serverName'),
	  clusterID : document.querySelector('#clusterID'),
	  serverLink : document.querySelector('#serverLink'),
	  hasPassword : document.querySelector('#passwordRequired'),
	  map : document.querySelector('#map'),
	  isPvP : document.querySelector('#isPvP'),
	  isOfficial : document.querySelector('#isOfficial'),
	  hasBattleEye : document.querySelector('#usesBattleEye'),
	  playerCount : document.querySelector('#playerCount'),
	  players : document.querySelector('#players'),
	  hasCharacterDownloads : document.querySelector('#playerDownloadsAllowed'),
	  hasItemDownloads : document.querySelector('#itemDownloadsAllowed'),
	  time : document.querySelector('#daytime'),
	  timeout : document.querySelector('#timeout'),
	},
  };

  
  
  return ui;
})();

var viewModel = (()=>{
  var _vm = new Observable({
    tabID : 0,
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
	      var pveServers = (filters.modes.includes('pve')) ? original.filter((server) => { return Boolean(server.name.match(/pve/gi)) || !server.rules.isPvP; }) : [],
	  	    pvpServers = (filters.modes.includes('pvp')) ? original.filter((server) => { return Boolean(server.name.match(/pvp/gi)) || server.rules.isPvP; }) : [],
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
		  if(filters.modes.includes('pvp')){ fPvP = (server.rules.isPvP !== '---') ? server.rules.isPvP : Boolean(server.name.match(/pvp/gi));}	  
		  if(filters.modes.includes('pve')){ fPvE = (server.rules.isPvP !== '---') ? !server.rules.isPvP : Boolean(server.name.match(/pve/gi));}
		  if(filters.modes.includes('noTame')){ fNoT = server.name.includes('NoTaming'); }
		  
		  return (filters.modes.length) ? (fPvP || fPvE || fNoT) : true;
	})(),
	    hasAllowedCustom = (filters.custom.trim().length) ? server.name.includes(filter.custom) : true;
    return hasAllowedMap && hasAllowedMode && hasAllowedCustom;
  };
  
  //Model/VM Change events
  _vm.subscribe('change/tabID', (tabID) => displayTab(tabID.new));
  _vm.subscribe('change/serverID', (serverID) => displayServerInfo(serverID.new));
  _vm.servers.subscribe('change', (server) => addServersToList(server.new)); //{ old: [], new : [Server,Server,Server]}
  _vm.subscribe('change/hosts', (hosts) => queryServers(hosts.new));
  
  model.subscribe('change/version', (version) => updateVersion(version.new));
  model.subscribe('change/news', (news) => displayNews(news.new));
  model.subscribe('change/serverStatus', (serverStatus) => displayServerStatus(serverStatus.new));
  model.servers.subscribe('change/add', (server) => _vm.servers(_vm.servers().concat(server.value)));// model -> filter -> vm -> ui
  
  filters.subscribe('change/maps', (map) => filters.update('maps'));
  filters.subscribe('change/modes', (mode) => filters.update('modes'));
  filters.subscribe('change/custom', (custom) => filters.update('custom'));
  
  //UI events
  var changeTabIndex = function(){  _vm.tabID = this.dataset.index; };
  var setServerID = function(){ _vm.serverID = this.dataset.name; };
  
  //Display tab 1 and hide the others.
  (()=>{
    Array.from(ui.tabs).forEach(x=> x.classList.add("hidden"));
    Array.from(ui.tabs)[0].classList.remove("hidden");
  })();
  
  //DOM event binding
  Array.from(ui.navItems).forEach((navItem) => navItem.onclick = changeTabIndex);
  var mapFilter = function(){
    if(this.checked){ filters.maps = filters.maps.concat(this.value); } 
    else { filters.maps = filters.maps.filter(condition => condition != this.value); }//remove
  },
      modeFilter = function(){
  	if(this.checked){ filters.modes = filters.modes.concat(this.value); } 
      else { filters.modes = filters.modes.filter(condition => condition != this.value); }
  };
  Array.from(ui.filters.maps).forEach(x=> x.onclick = mapFilter);
  Array.from(ui.filters.modes).forEach(x=> x.onclick = modeFilter);
  ui.filters.custom.oninput = (e) => { filters.custom = e.target.value; };
   
  //VM events
  var displayTab = (tabID) => {
    var tabs = Array.from(ui.tabs),
	    selectedTab = tabs.find((tab)=> tab.dataset.index == tabID);
    if(selectedTab){
	  tabs.forEach((tab)=> tab.classList.add('hidden'));
	  selectedTab.classList.remove('hidden');
	}	
  };
  var updateVersion = (version) => {
    ui.version.innerText = version;
	ui.majorVersion.innerText = parseInt(version).toFixed(0);
  };
  var displayServerStatus = (status) => {
    var statuses = status.split(rsc.utils.regex.newlines),
	    addStatus = (statusItem) => {
		  var p = document.createElement('p');
		  p.innerText = statusItem;
		  ui.serverStatus.appendChild(p);
		};
		
	statuses = statuses.filter(x => x.trim() != "").map(y => y.replace(rsc.utils.regex.tags,""));
	statuses.forEach(addStatus);
  };
  var displayNews = (news) => {
    var newsItems = news.split(rsc.utils.regex.newlines),
		addNews = (newsItem) => {
		  var p = document.createElement('p');
		  p.innerText = newsItem;
		  ui.news.appendChild(p);
		};
			
	newsItems = newsItems.filter(x => x.trim() != "").map(y => y.replace(rsc.utils.regex.tags,""));
	newsItems.forEach(addNews);
  };
  var displayServerInfo = (serverID) => {
    var server = model.servers().find((server) => server.name == serverID)
    if(server){  
	  Object.keys(server).forEach((key) => {  
	    function mapData(prop, data){
	      document.querySelector(`[data-prop='${prop}']`).innerText = data;	  
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
  }
  var queryServers = (ipList) => {  	
	document.querySelector(".loadingSpan").classList.add("loading");
	loadServers();
  };
  var addServerToList = (server) => {	
	if(filters.test(server)){ 
	  ui.servers.appendChild(createLI(server));
	}
	else { console.log("You've lost the game");}
  };
  var addServersToList = (serverList) => {
    serverList.sort((a,b) => a.name.localeCompare(b.name,"en-US-u-kn-true"));
	//console.log('sl:', serverList);
	
    var currentList = Array.from(document.querySelectorAll('#hosts li')).map((li)=> li.dataset.name),
	    newList = serverList.map((server) => server.name);
			
	var additions = newList.filter((id) => { return !currentList.includes(id) && filters.test(serverList.find((server) => server.name == id));}),
	    removals = currentList.filter((id) => !newList.includes(id));
		
	var parent = ui.servers;
	
	//console.log('additions:',additions);
	//console.log('removals: ', removals.length);
	
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
  };
  
  //Utility
  var createLI = (server) => {
    var li = document.createElement('li');
	li.onclick = setServerID;
	li.innerText = server.name;
	li.dataset.name = server.name;
	
	return li;
  };
  
  var loadServers = () => {
    if(!_vm.hosts.length){
	  ui.loadingSpan.classList.remove('loading');
	  ui.loadingSpan.classList.add('done');
	} else {
	  var ip = _vm.hosts.shift();
	  rsc.serverInfo(ip).then(x=>{
	    //vm.data.servers.sort((y,z) => y.name.localeCompare(z.name,"en-US-u-kn-true"));
		model.servers.add(new Server(x.value));
	  })
	  .catch((err)=>{})
	  .then(()=> loadServers());	
	}
  };
  
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
	  console.log(x); 
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