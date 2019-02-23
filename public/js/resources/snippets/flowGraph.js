'use strict';
var snippet = {
	name: "flowgraph",
	value: "Graph a Flow over axis",
	
	options: {
		color: {defaultValue: "#FF0000", type: 'text'},
		legend: {defaultValue: "top", type: 'select', availableValues: [true, false, "top", "bottom"]}
	},
	getSample: function() {
		var html = "";
		html += "<div class='flowgraph tile card-flowgraph material-animate margin-top-4 material-animated mdl-shadow--2dp is-ontime'>";
		html += "</div>";
		return html;
	},
	getHtml: function(params) {
		return "<div class='flowgraph tile card-valuedisplay material-animate margin-top-4 material-animated mdl-shadow--2dp'>"+params.name+"</div>";
		//sprintf("<div class='valuedisplay tile card-valuedisplay material-animate margin-top-4 material-animated mdl-shadow--2dp'>%s</div>", "");
	},
}
app.snippetTypes.push(snippet);