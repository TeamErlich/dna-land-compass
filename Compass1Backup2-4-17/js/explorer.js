/* 

Copyright (C) 2016 Erlich Lab
License: BSD (see LICENSE file) 

*/

var options, tabix, vcf, threshold, query, questionHTML, regions, index, reader, combinedData, vcfR, batchSize, accordionIndex, accordionHTML;    

$(function() {

	makeSettings();

	/* initialize the jQuery UI accordion, used for displaying SNP data */
	$("#accordion").accordion({
		icons: false,
		beforeActivate: function(event, ui) {

			if (ui.newHeader.hasClass("disabled")) {
				return event.preventDefault(); 
			}

			ui.newHeader.addClass("presentedSection");
			ui.newPanel.addClass("presentedSection");
			ui.oldHeader.removeClass("presentedSection");
			ui.oldPanel.removeClass("presentedSection");
		}
	});

	hideDisclaimer();

});

$(window).on('beforeunload', function() {
    $(window).scrollTop(0);
});

$("#files").change(function() { 

	var files = $("#files")[0].files;

	$("#details").empty();

	/* validate user's file input */
	var result = checkFiles(files); 

	if (!result[2]) { /*There was a problem with the user's files.*/

		$("#byrsID, #byGroup").addClass("hiddeninput");

		$("#details").append("<b>Error:</b> " + result[0]);

		if (files.length > 0) {

			$("#details").append("<br><b>Description:</b> You have selected the following files:");

			var fileNamesDiv = "<div class=\"fileNames\">";
			var isMatchProblem = result[0] == "Those files don't match.";

			/* format the files' names to highlight either the beginning or the extension */
			var names = $.map(files, function(item, index) {
				return boldExtensions(item.name, isMatchProblem); 
			}).reduce(function(one, two, index, array) {
				return one + "<br>" + two; 
			}); 

			fileNamesDiv += names; 
			fileNamesDiv += "</div>";

			$("#details").append(fileNamesDiv);
		}

		$("#details").append("<b>Suggestion:</b> " + result[1]);

		setInvalid(); 
		$('input[type="file"]').val(null);
		return; 

	}

	vcf = isVCF(files[0]) ? files[0] : files[1];
	tabix = isTabix(files[1]) ? files[1] : files[0];

	setPrefix(files);
	writeSelected(); 
	removeAccordion(); 

	$('input[type="file"]').val(null); //allows the input and handler to be reused
	$("#byrsID, #byGroup").removeClass("hiddeninput");
	setValid(); 

	/*clear input*/
	$('#rsID').val('');
	$("#groupSelect").val('N');

	hideDisclaimer(); 

});

function boldExtensions(name, invert) {
	
	var sections = name.split(".");

	var bolded = $.map(sections, function(item, index) {

		if (index != sections.length - 1) {
			item += ".";
		}

		if (!invert) {

			if (item.length <= 4) { 
				return "<b>" + item + "</b>";
			} 

			return item; 

		} 

		if (index == 0) { 
			return "<b>" + item + "</b>";
		} 

		return item; 

	}).reduce(function(one, two, index, array) {
		return one + two; 
	}); 

	return bolded;

}

function checkFiles(files) { //returns an array of [error type, error descripton, success]

	if (files.length > 2) {
		return ["You selected more than two files.", "Please select only two files.", false];
	}

	if (files.length < 2) {
		return ["You selected fewer than two files.", "Please select two files.", false];
	}

	var uploadedVCF = isVCF(files[0]) || isVCF(files[1]);
	var uploadedTabix = isTabix(files[0]) || isTabix(files[1]);
	var uploadedDecompressedVCF = isDecompressedVCF(files[0]) || isDecompressedVCF(files[1]);

	if (!uploadedVCF && !uploadedTabix) {

		if (uploadedDecompressedVCF) {
			return ["You did not select a <b>.vcf.gz</b> or a <b>.vcf.gz.tbi</b>.", "This site requires a <b>.vcf.gz</b> and a <b>.vcf.gz.tbi</b> to work. You may need to redownload this file from <a href=\"DNA.Land\">DNA.Land</a>.", false];
		}

		return ["You did not select a <b>.vcf.gz</b> or a <b>.vcf.gz.tbi</b>.", "This site requires a <b>.vcf.gz</b> and a <b>.vcf.gz.tbi</b> to work.", false];
	}

	if (!uploadedVCF && uploadedTabix) {

		if (uploadedDecompressedVCF) {
			return ["You did not select a <b>.vcf.gz</b>.", "This site reqires a <b>.vcf.gz</b> to work. You may need to redownload this file from <a href=\"DNA.Land\">DNA.Land</a>.", false];
		}

		return ["You did not select a <b>.vcf.gz</b>.", "This site requires a <b>.vcf.gz</b> to work. You can download this file from <a href=\"DNA.Land\">DNA.Land</a>.", false];
	}

	if (uploadedVCF && !uploadedTabix) {
		return ["You did not select a <b>.vcf.gz.tbi</b>.", "This site requires a <b>.vcf.gz.tbi</b> to work. You can download this file from <a href=\"DNA.Land\">DNA.Land</a>.", false];
	}

	/* By now, uploadedVCF && uploadedTabix */

	if (!checkFilesMatch(files[0], files[1])) {
		return ["Those files don't match.", "This site requires a <b>.vcf.gz</b> and a <b>.vcf.gz.tbi</b> that <b><em>match</em></b> to work.", false];
	}

	return ["", "", true];

}

function isDecompressedVCF(file) {

	var n = file.name; 

	return n.split(".").slice(-1)[0] == "vcf" && (n.split(".").length == 2 || (n.split(".").length == 3 && n.split(".").slice(-2)[0] == "imputed")); 

}


function isTabix(file) {

	var n = file.name; 

	return n.split(".").slice(-1)[0] == "tbi" && n.split(".").slice(-2)[0] == "gz" && n.split(".").slice(-3)[0] == "vcf"; 

}

function isVCF(file) {

	var n = file.name;

	return (n.split(".").slice(-1)[0] == "vcf" && n.split(".").slice(-2)[0] == "gz" && n.split(".").slice(-3)[0] == "vcf") || (n.split(".").slice(-1)[0] == "gz" && n.split(".").slice(-2)[0] == "vcf");

}

function setPrefix(files) {

	var p = files.length > 0 ? files[0].name.substring(0, files[0].name.indexOf(".")) : "";

	var separators = ["_", " ", ",", "."];

	var replaced = p; 

	for (var i = 0; i < separators.length; i++) {
		replaced = replaced.replace(separators[i], "/");
	}

	var split = replaced.split("/");


	var text = split.reduce(function(one, two, index, array) {
		return one.capitalize() + " " + two.capitalize(); 
	});


	$("#fileNumber").text(text);
}

function checkFilesMatch(fileOne, fileTwo) {

	var one = fileOne.name; 
	var two = fileTwo.name;

	return one.split(".").slice(0)[0] == two.split(".").slice(0)[0];

}

$("#rsIDForm").submit(function(event) {
	event.preventDefault();

	var shake = $("#rsIDFormWrapper");

	var rsID = $("#rsID").val(); 

	if (rsID.indexOf("rs") == -1) {
		rsID = "rs" + rsID; 
	}

	if (!isValidrsID(rsID)) {
		shake.addClass("invalid");

		shake.one("webkitAnimationEnd msAnimationEnd oanimationend animationend", function (e) {
        	shake.removeClass("invalid");
        });

		$("#rsIDForm").val(null);
		return; 
	}

	if (tabix != null && vcf != null) {

		/* if the user uploaded valid files and selected a valid rsID, fetch the data for the SNP */
		requestByID(rsID);
	} 

	query = rsID; 
	$("#rsIDForm").val(null);
	hideDisclaimer(); 
	removePresented(); 

});

function isValidrsID(rsID) {

	var letters = rsID.substring(0, 2);
	var hasRS = (letters == "rs");

	var numbers = rsID.substring(2);
	var isNumeric = /^\d+$/.test(numbers);

	return hasRS && isNumeric; 

}

function removePresented() {

	$("h3, div").removeClass("presentedSection");

}

function makeSettings() { 

	$("#groupSelect").selectedIndex = -1; 
	getOptions();
	threshold = 600; 
	doubleborder = 12; 
	questionHTML = "<a href=\"faq.html#Q1\" target=\"\"><img class=\"icon help\" width=\"16\" height=\"16\" style=\"padding-bottom: 2px;\"></a>";
	batchSize = 10; 

}

function addOptions() {

	/* define the functionality for string matching in the typeahead that suggests categoresi when the user dypes in "Search" */
	var substringMatcher = function(strs) {
	  return function findMatches(q, cb) {
	    var matches, substringRegex;

	    matches = [];

	    substrRegex = new RegExp(q, 'i');

	    $.each(strs, function(i, str) {
	      if (substrRegex.test(str)) {
	        matches.push(str);
	      }
	    });

	    cb(matches);
	  };
	};

	$(".typeahead").typeahead({
	  hint: true,
	  highlight: true,
	  minLength: 1
	},
	{
	  name: "options",
	  source: substringMatcher(options)
	});

	$('.typeahead').bind('typeahead:select', function(ev, group) {
  		query = group; 

		if (tabix != null && vcf != null) {

			/* when the user selects a group, if their files are valid, fetch the data for the group */
			requestGroup(group);
		}

		showDisclaimer(); 
		removePresented(); 
	});

}

function showDisclaimer() {

	$(".disclaimer").removeClass("hiddenAlertX");

}

function hideDisclaimer() { 

	$(".disclaimer").addClass("hiddenAlertX");

}

function setValid() { 

	$("#fileinputicon").removeClass("invalid");
	$("#fileinputicon").addClass("valid");

}

function setInvalid() {

	$("#fileinputicon").removeClass("valid");
	$("#fileinputicon").addClass("invalid"); 

}

function removeStyling() { 

	$("#fileinputicon").removeClass("valid");
	$("#fileinputicon").removeClass("invalid"); 

}

function requestByID(rsID) {

	updateProgressMessage("Loading coordinates...");
	showSpinner(); 

	dataForID(rsID);

}

function requestGroup(group) {

	updateProgressMessage("Loading coordinates...");
	showSpinner(); 

	dataForGroup(group);

}

function dataForID(rsID) {

	removeProgress();

	/* do an Ajax request to get the chromosome and coordinates of the SNP whose rsID the user entered */
	$.ajax({
        url: "http://df.charlie.teamerlich.org/api/v2/snps/_table/dbsnp",
        type: "GET",
        data: { 
        	filter: "rsid=" + rsID, 
        	api_key : "94369a3701477abfbda08a237e17a1d88ba448bb81fb0026cce3f7ea004423cd"
        },
        contentType: "application/json; charset=utf-8",
        success: function (response) {
            parseJSONforID(rsID, response);
        },
        error: function (e) {
            console.log("Ajax failed: " + e.responseText);
        }
    }); 
}


function dataForGroup(group) { 

	$("#details").empty();	
	removeProgress();

	/* get all chromsome-coordinate pairs for SNPs that relate to the topic the user specified */
	$.ajax({
		url: "http://df.charlie.teamerlich.org/api/v2/snps/_table/groupsnps",
		type: "GET", 
		data: {
			filter: "name=" + group,
			api_key: "94369a3701477abfbda08a237e17a1d88ba448bb81fb0026cce3f7ea004423cd"
		}, 
		contentType: "application/json; charset=utf-8", 
		success: function(response) {
			parseJSONforGroup(group, response);
		}, 
		error: function(e) {
			console.log("Ajax failed: " + e.responseText);
		}
	});

}

function writeSelected() {

	$.ajax({
		url: "http://compass.dna.land/log/selected",
		type: "GET", 
		contentType: "application/json; charset=utf-8", 
		cache: false, 
		success: function(response) {
		
		}, 
		error: function(e) {

		}
	});

}

function writeLoaded() { 


	$.ajax({
		url: "http://compass.dna.land/log/loaded",
		type: "GET", 
		contentType: "application/json; charset=utf-8", 
		cache: false, 
		success: function(response) {
		
		}, 
		error: function(e) {
			
		}
	});

}

function writeReported() { 


	$.ajax({
		url: "http://compass.dna.land/log/reported",
		type: "GET", 
		contentType: "application/json; charset=utf-8", 
		cache: false, 
		success: function(response) {
		
		}, 
		error: function(e) {
			
		}
	});

}

function getOptions() { 

	/* fetch the lsit of topics the user can choose from */
	var names = $.ajax({
		url: "http://df.charlie.teamerlich.org/api/v2/snps/_table/groupnames",
		type: "GET", 
		data: {
			api_key: "94369a3701477abfbda08a237e17a1d88ba448bb81fb0026cce3f7ea004423cd"
		}, 
		contentType: "application/json; charset=utf-8", 
		success: function(response) {
			setOptions(response);
		}, 
		error: function(e) {
			console.log("Ajax failed: " + e.responseText);
		}
	}); 

}

function setOptions(data) { 

	var resources = data.resource;

	var names = []; 

	for (var value in resources) { 
		names[value] = resources[value].name; 
	}

	options = names; 

	addOptions();

}

function removeAccordion() { 

	$("#accordion").empty(); 

}

function animateProgress(done, total) {

	var totalWidth = $("#SNPLoading").width();
	var indicatorWidth = (done / total) * totalWidth; 

	$("#SNPIndicator").stop(true, true);

	$("#SNPIndicator").animate({
		width: indicatorWidth
	});

}

function removeProgress() { 

	$("#SNPIndicator").animate({
		width: 0
	});

}

function parseJSONforID(rsID, data) { //JSON has id, chromosome, position //returns 2D array
	
	var resources = data.resource[0];

	$("#details").empty();
	if (typeof resources == "undefined" || resources.length == 0) {
		return snpError(); 
	}

	var id = resources["rsid"];
	var chromosome = resources["chrom"];
	var position = resources["pos"];

	/* retrieve the data from the user's VCF by chromsome and position */
	accessData([[chromosome, position, id]]);

}

function parseJSONforGroup(group, JSON) { //JSON has SNP (id, chromosome, position) //returns 2D array


	var resources = JSON.resource;
	var data = [];

	if (typeof resources == "undefined" || resources.length == 0) {
		$("#details").html("We couldn't find that group.");
		hideSpinner(); 
		updateProgressMessage("");
		return; 
	}

	/* store the chromsome and coordinates of the relevant SNPs in an array of size [resources.length - 1][2] */
	for (var i = 0; i < resources.length; i++) {
		data[i] = [resources[i]["chrom"], resources[i]["pos"], resources[i]["rsid"]];
	}

	accessData(data);

}

function accessData(regions) { //regions[x][0] gives the chromosome; regions[x][1] gives the position; both are strings. also includes rsid at [x][2] to report later)

	accordionHTML = ""; 
	writeLoaded(); 

	$("#accordion").empty(); 
	$("#select").html("Loading records");
	$("#fileTypeInfo").html("Processing your data");

	var validRegions = regionsIsValid(regions);

	if (!validRegions) {
		return snpError();
	}

	this.regions = regions; 
	this.index = 0; 

	updateProgressMessage("Reading index file...");

	combinedData = new Array(regions.length);

	if (typeof reader !== 'undefined') {
		return fireSNP(vcfR);
	}

	reader = new readBinaryVCF(tabix, vcf, function(vcfR) {

		fireSNP(vcfR); 

	});

}

function fireSNP(vcfR) {

	/* retrieve the data after a timeout, which allows the browser to update and makes the site appear more responsive */
	setTimeout(function() {

		var row = regions[index];

		var chr = 0; 

		/* find the index which corresponds to the chromsome as specified in the hash */
		for (key in vcfR.idxContent.namehash) {
			if (key == row[0]) {
				chr = vcfR.idxContent.namehash[key];
			}
		}

		this.vcfR = vcfR; 

		reader.getRecords(chr, parseInt(row[1]), parseInt(row[1]), loadCompleted);

	}, 50);

}

var loadCompleted = function(data) {

	combinedData[index] = data;

	index++; 

	if (index >= regions.length) {

		/* if all SNP data has been retreived, generate the report */
		updateProgressMessage("Generating report...");

		setTimeout(function() {

			processData(combinedData)

		}, 100);

		return; 

	}

	updateProgressMessage("Loading genotype " + (index + 1) + " / " + regions.length);

	fireSNP(vcfR);

}

function snpError() { 

	hideSpinner(); 
	updateProgressMessage("");

	$("#select").html("Select your files"); 
	$("#fileTypeInfo").html("Please select a <a href=\"faq.html#Q4\" target=\"_blank\">compressed VCF</a> (<b>.vcf.gz</b>) and a <a href=\"faq.html#Q5\" target=\"_blank\">Tabix file</a> (<b>.tbi</b>)");

	var HTML = "Sorry, we currently do not support " + query + ".<br>We only support simple SNPs from dbSNP human build 141.<br>Try checking here: ";

		HTML += "<a id=\"override\" target='_blank' href='http://www.snpedia.com/index.php/" + query.capitalize() + "'>SNPedia</a> ";
		HTML += "<a id=\"override\" target='_blank' href='http://www.ncbi.nlm.nih.gov/pubmed/?term=" + query + "'>PubMed</a> ";
		HTML += "<a id=\"override\" target='_blank' href='http://www.ncbi.nlm.nih.gov/projects/SNP/snp_ref.cgi?rs=" +query.substring(query.indexOf("s") + 1) + "'>dbSNP</a> ";
		HTML += "<a id=\"override\" target='_blank' href='http://www.gwascentral.org/studies?page_size=50&q=" + query + "&t=ZERO&m=all&l=all&format=html'>GWAS</a> ";
		HTML += "<a id=\"override\" target='_blank' href='https://www.google.com/search?q=" + query + "'>Google</a>";

	$("#details").append(HTML); 

}

function regionsIsValid(regions) {

	return regions.length > 0; 

}

function processData(data) {

	if (!(typeof data[0] !== "undefined" && data[0].length > 0)) {
		$("#details").html("<strong>Your files are missing a SNP you requested.</strong>");
		console.log("INVALID");
		return; 
	}

	$("#select").html("select your files"); 
	$("#fileTypeInfo").html("Please select a <a href=\"faq.html#Q4\" target=\"_blank\">compressed VCF</a> (<b>.vcf.gz</b>) and a <a href=\"faq.html#Q5\" target=\"_blank\">Tabix file</a> (<b>.tbi</b>)");

	accordionIndex = 0; 

	fireAccordionPane(); 

}

function fireAccordionPane() {

	/* fetch batchSize SNPs from accordionIndex, unless that exceeds the bounds of the array */
	var end = (accordionIndex + batchSize >= combinedData.length) ? (combinedData.length - 1) : (accordionIndex + batchSize);

	setTimeout(function() {

		for (var i = accordionIndex; i <= end; i++) {

			var row = combinedData[i][0];

			try { 
				var split = row.split("\t");
			} catch (error) {
				console.log("Error " + error + " with row " + row);
			}

			var fileRSID = split[2]; 
			var serverRSID = regions[i][2];

			if (fileRSID !== serverRSID) { 
				console.log("Replacing " + fileRSID + " with " + serverRSID);
				split[2] = serverRSID;
			}


			displaySNP(split); 

		}

		batchGenerated();

	}, 50); 


}

function batchGenerated() { 

	accordionIndex += batchSize; 

	if (accordionIndex + batchSize >= combinedData.length) {

		/* display the results from the user's query */
		return accordionFinishedGenerating(); 
	}

	fireAccordionPane();

}

function accordionFinishedGenerating() {

	generateReport();
	setDefault();
	styleDefaultPane();
	hideSpinner(); 
	updateProgressMessage("");

	scroll();

}

function setDefault() { 

	$("#accordion").accordion({
   		active: false,
    	collapsible: true            
	});

	$("#accordion").accordion("option", "active", false);
	$("#accordion").accordion("option", "active", 1);

	/*open SNPedia for active SNP*/
	$("div.ui-accordion-content-active a.left").click(); 
	setiFrame($("div.ui-accordion-content-active a.left").attr("href"));

}

function setiFrame(s) {

	$("#infoiframe").attr('src', s);
}

function styleDefaultPane() {
	var actives = $("#accordion").accordion("option", "active");

	var header = $("#accordion h3").eq(actives);
	var panel = $("#accordion div").eq(actives);

	header.addClass("presentedSection");
	panel.addClass("presentedSection");
}

function scroll() { 
	var offset = 30; //remove once nav configured to be thinner (not thicker) when down the page 

	$('html, body').animate({
        scrollTop: $("#accordion").offset().top - $("nav").height() - offset
    }, 1000);
}

function makeHeader() { 

	$("#accordion").css("background-color", "#EEECDD");
	$("#infoiframe").css("border-color", "#EEECDD");
	$("#infoiframe").addClass("showsBackground");

	var HTML = ""; 

	HTML += "<h3 class=\"exp disabled\">"; 
		HTML += "<table>";
			HTML += "<tr id=\"override\">";
				HTML += "<td class=\"rsIDText\">SNP</td>";
				HTML += "<td class=\"geno\">Your Genotype</td>";
				HTML += "<td class=\"chromosome\">Chrom</td>";
			HTML += "</tr>";
		HTML += "</table>";
	HTML += "</h3>";

	HTML += "<div class=\"disabled\">";
	HTML += "</div>";


	accordionHTML = HTML + accordionHTML; 

}

function generateReport() { 

	console.log(combinedData);

	makeHeader(); 

	$("#accordion").append(accordionHTML);
	$("#accordion").accordion("refresh");

	writeReported(); 
}

function displaySNP(data) {

	console.log("DATA: ");
	console.log(data);

	var binaryGenotype = data[9];
	binaryGenotype = binaryGenotype.substring(0, binaryGenotype.indexOf(":"));
	var reference = data[3];
	var alternate = data[4];

	/* determine the user's genotype in nucleotides */
	var geno = ""; 
	if (binaryGenotype == "0/0") {
		geno = reference + reference; 
	} else if (binaryGenotype == "1/1") {
		geno = alternate + alternate; 
	} else if (binaryGenotype == "0/1") { 
		geno = reference + alternate; 
	} else { 
		geno = alternate + reference; 
	}

	var chr = data[0]; 
	var locus = data[1];

	var HTML = ""; 

	HTML += "<h3 class=\"exp\">"; 
		HTML += "<table>";
			HTML += "<tr id=\"override\">";
				HTML += "<td class=\"rsIDText\">" + data[2] + "</td>";
				HTML += "<td class=\"geno\">" + geno + "</td>";
				HTML += "<td class=\"chromosome\">" + data[0] + "</td>";
			HTML += "</tr>";
		HTML += "</table>";
	HTML += "</h3>";

	HTML += "<div>";
		HTML += "<a id=\"override\" onclick=\"actionClicked(this);\" class=\"left action\" target='infoiframe' href='http://www.snpedia.com/index.php/" + data[2].capitalize() + "'>SNPedia</a>";
		HTML += "<a id=\"override\" onclick=\"actionClicked(this);\" class=\"action\" target='infoiframe' href='http://www.ncbi.nlm.nih.gov/pubmed/?term=" + data[2] + "'>PubMed</a>";
		HTML += "<a id=\"override\" onclick=\"actionClicked(this);\" class=\"action\" target='infoiframe' href='http://www.ncbi.nlm.nih.gov/projects/SNP/snp_ref.cgi?rs=" + data[2].substring(data[2].indexOf("s") + 1) + "'>dbSNP</a>";
		HTML += "<a id=\"override\" onclick=\"actionClicked(this);\" class=\"action\" target='infoiframe' href='http://www.gwascentral.org/studies?page_size=50&q=" + data[2] + "&t=ZERO&m=all&l=all&format=html'>GWAS</a>";
		HTML += "<a id=\"override\" onclick=\"actionClicked(this);\" class=\"right action\" target='_blank' href='https://www.google.com/search?q=" + data[2] + "'>Google</a>";
	HTML += "</div>";

	accordionHTML += HTML; 

}

function updateProgressMessage(message) {

	$("#progressMessage").text(message);

}

function hideSpinner() { 

	$("#progressAnimation").addClass("hidden");

}

function showSpinner() {

	$("#progressAnimation").removeClass("hidden");

}

function actionClicked(action) {

	$(".action.active").each(function() {
		$(this).removeClass("active");
	});

	$(action).addClass("active");

}

String.prototype.capitalize = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
}