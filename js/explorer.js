/* 

Copyright (C) 2016 Erlich Lab
License: BSD (see LICENSE file) 

*/

var options, tabix, vcf, threshold, query, questionHTML, regions, index, reader, combinedData, vcfR, batchSize, accordionIndex, accordionHTML, catalog, buildVersion, bvReader, h3IDs;  
var colorForSNPs = "#27A4A8"
var hoverColor = "#19696b";
var highlightColor = "#007fff";  

$(function() {

	makeSettings();

	initializeAccordion();

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

function initializeAccordion() {

	/* initialize the jQuery UI accordion, used for displaying SNP data */
	$("#accordion").accordion({
		icons: false,
		beforeActivate: function(event, ui) {

			if (ui.newHeader.hasClass("disabled")) {
				console.log("cancelling1");
				return event.preventDefault(); 
			}

			if (ui.newHeader.attr("id") === ui.oldHeader.attr("id")) { 
				console.log("cancelling2"); 
				return event.preventDefault(); 
			}

			// if (typeof ui.newHeader.attr("id") === "undefined") { 
			// 	console.log("cancelling2");
			// 	return event.preventDefault(); 
			// }

			ui.newHeader.addClass("presentedSection");
			ui.newPanel.addClass("presentedSection");
			ui.oldHeader.removeClass("presentedSection");
			ui.oldPanel.removeClass("presentedSection");

			var newID = ui.newHeader.attr("id");

			if (typeof newID !== "undefined") {
				setSNPColor(newID.slice(2), highlightColor);
			}

			var oldID = ui.oldHeader.attr("id");

			if (typeof oldID !== "undefined") {
				setSNPColor(oldID.slice(2), colorForSNPs);
			}


			var h3ID = ui.newHeader.attr("id");
			var SNPediaLink = $("h3#" + h3ID + " + div a.SNPedia"); 
			SNPediaLink.click(); 

			setiFrame(SNPediaLink.attr("href"));

		}
	});
}

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
	catalog = {}; 
	h3IDs = []; 

}

function clearCatalog() { 
	catalog = {};
}

function addOptions() {

	/* define the functionality for string matching in the typeahead that suggests categories when the user types in "Search" */
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

	setBuildVersion(rsID, true); 

}


function requestGroup(group) {

	updateProgressMessage("Loading coordinates...");
	showSpinner(); 

	setBuildVersion(group, false); 

}

function setBuildVersion(dataToRetrieve, dataIsID) { 

	clearCatalog();

	var bvReader = new readBinaryVCF(tabix, vcf, function(vcfR) {

		var header = bvReader.getHeader(function(header) {

			if (header == "") {
				$("#details").html("That file doensn't seem to have a header. We'll assume it's using GRCh37.");
				buildVersion = 37; 

				if (dataIsID) {
					dataForID(dataToRetrieve);
				} else { 
					dataForGroup(dataToRetrieve);
				}
			} 

			var multipleSamples = !isOneSample(header); 
			if (multipleSamples) {
				$("#details").html("The compressed VCF file you selected contains multiple samples. Please select a compressed VCF file that contains only one sample.");
				updateProgressMessage("");
				hideSpinner();
				return; 
			}

			clearDetails(); 

			var reference = header.substring(
				header.indexOf("##reference"), 
				header.indexOf("#", header.indexOf("##reference") + 2)
			).toUpperCase(); 

			if (reference == "" || header.indexOf("##reference") < 0) {
				$("#details").html("That file doensn't seem to have a reference tag. We'll assume it's using GRCh37.");
				buildVersion = 37; 

				if (dataIsID) {
					dataForID(dataToRetrieve);
				} else { 
					dataForGroup(dataToRetrieve);
				}
			} 

			clearDetails(); 

			var keywords = [
				[["GRCh36"], 36],
				[["GRCh37"], 37],
				[["GRCh38"], 38], 
				[["Ensembl", "54"], 36],
				[["Ensembl", "67"], 37],
				[["Ensembl", "74"], 37],
				[["Ensembl", "75"], 37],
				[["Ensembl", "76"], 38],
				[["Ensembl", "77"], 38],
				[["Ensembl", "78"], 38],
				[["Ensembl", "79"], 38],
				[["Ensembl", "82"], 38],
				[["Ensembl", "86"], 38],
				[["b36"], 36],
				[["b37"], 37],
				[["b38"], 38],
				[["hs36"], 36],
				[["hs37"], 37],
				[["hs38"], 38]

			];

			for (var i = 0; i < keywords.length; i++) {

				var isMatch = true;

				var terms = keywords[i][0]; 

				for (var j = 0; j < terms.length; j++) {

					var searchTerm = terms[j].toUpperCase(); 

					if (!reference.includes(searchTerm)) {
						isMatch = false; 
						break; 
					}

				} 

				if (isMatch) {
					buildVersion = keywords[i][1];
					console.log("set buildVersion to " + keywords[i][1]);
					clearDetails();
					break; 
				}

				if (i == keywords.length - 1) {//we didn't find the build number

					$("#details").html("We can't tell what reference this file is using. We'll assume it's using GRCh37.");
					buildVersion = 37; 

				}

			}

			if (buildVersion != 37 && buildVersion != 38) { 
				$("#details").html("We currently only supports builds GRCh37 and GRCh38. We do not support build " + buildVersion + "."); 
				updateProgressMessage("");
				hideSpinner();
				return; 
			}

			if (dataIsID) {
				dataForID(dataToRetrieve);
			} else { 
				dataForGroup(dataToRetrieve);
			}

		}); 

	});

}

function isOneSample(header) { 

	var start = header.indexOf("#CHROM"); 

	var columnHeaders = header.substring(start).split("\n")[0];
	var samples = columnHeaders.substring(columnHeaders.indexOf("FORMAT") + 7);

	var samplesArray = samples.split(/\s+/g); 

	console.log(samplesArray);

	return samplesArray.length <= 1;
}

function dataForID(rsID) {

	/* do an Ajax request to get the chromosome and coordinates of the SNP whose rsID the user entered */
	$.ajax({
        url: "http://df.charlie.teamerlich.org/api/v2/compass-v2/_table/dbsnp_with_cytobands_grch" + buildVersion,
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
	// removeProgress();

	/* get all chromsome-coordinate pairs for SNPs that relate to the topic the user specified */
	$.ajax({
		url: "http://df.charlie.teamerlich.org/api/v2/compass-v2/_table/associated_dbsnp_with_cytobands_grch" + buildVersion,
		type: "GET", 
		data: {
			filter: "trait=" + group,
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

function getAllCytobands() { 

	$.ajax({
        url: "http://df.charlie.teamerlich.org/api/v2/compass-v2/_table/cytobands_grch" + buildVersion,
        type: "GET",
        data: { 
        	api_key : "94369a3701477abfbda08a237e17a1d88ba448bb81fb0026cce3f7ea004423cd"
        },
        contentType: "application/json; charset=utf-8",
        success: function (response) {

        	makeCytobandDiagram(response);

        },
        error: function (e) {
            console.log("Ajax failed: " + e.responseText);
        }
    }); 

}

function makeCytobandDiagram(data) {

	var element = "#cytobandsCanvas"
	var rawData = data.resource;

	//first, clear the canvas
	$(element).empty();

	var cytobands = []; 

	for (var i = 0; i < rawData.length; i++) {

		var array = []; 

		$.each(rawData[i], function(index, value) {

			if (index !== "id") {
   				array.push(String(value));
   			}
   		});	

   		cytobands[i] = array; 
	}

	if (isInternetExplorer()) {

		$("svg #error").text("Sorry! We don't currently support this browser. Please try Microsoft Edge or Google Chrome.");

		return;
	}

	$("svg #error").text("");

	drawCytobands(cytobands, element);

	var SNPs = $(regions).map(function(index, value) {
		var chromAndPos = [parseInt(value[0]), parseInt(value[1])]; 
		return [chromAndPos];
	}); 

	drawSNPs(SNPs, element);

	setHovers();
	giveFirstColor();

}

function setHovers() { 

	var id; 
	for (var i = 0; i < h3IDs.length; i++) {

		id = h3IDs[i];

		$("#" + id).hover(function() {

			if (!$(this).hasClass("presentedSection")) {
				setSNPColor($(this).attr("id").slice(2), hoverColor);
			}

		}, function() {

			if (!$(this).hasClass("presentedSection")) {
				setSNPColor($(this).attr("id").slice(2), colorForSNPs);
			}
		});
	}
}

function giveFirstColor() { //since cytoband diagram doesn't exist when accordion is initalized

	var id = $("h3.presentedSection").attr("id");

	setSNPColor(id.slice(2), "#007fff");

}

function isInternetExplorer() {
    var ua = window.navigator.userAgent;

    var msie = ua.indexOf('MSIE ');
    if (msie > 0) {
        return true; 
    }

    var trident = ua.indexOf('Trident/');
    if (trident > 0) {
        var rv = ua.indexOf('rv:');
        return true; 
    }

    return false;
}

function clearDetails() { 

	$("#details").empty(); 

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

	/* fetch the list of topics the user can choose from */
	var names = $.ajax({
		url: "http://df.charlie.teamerlich.org/api/v2/compass-v2/_table/unique_associations",
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

	var traits = []; 

	for (var value in resources) { 
		traits[value] = resources[value].trait; 
	}

	options = traits; 

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

function parseJSONforID(rsID, data) { //JSON has id, chromosome, position //returns 2D array
	
	var resources = data.resource[0];

	$("#details").empty();
	if (typeof resources == "undefined" || resources.length == 0) {
		return snpError(); 
	}

	/* catalog by rsid information not needed for extraction */
	catalog[resources["rsid"]] = {
		"band": resources["band"], 
		"start": resources["start"], 
		"finish": resources["finish"]
	};
	
	/* retrieve the data from the user's VCF by chromsome and position */
	accessData([[resources["chrom"], resources["pos"], resources["rsid"]]]);

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

	for (var i = 0; i < resources.length; i++) {

		var record = resources[i];

		catalog[record["rsid"]] = {
			"band": record["band"], 
			"start": record["start"], 
			"finish": record["finish"], 
			"trait": record["trait"], 
			"riskallele": record["riskallele"], 
			"or_beta": record["or_beta"]
		};

		data[i] = [record["chrom"], record["pos"], record["rsid"]];
	}

	accessData(data);

}

function accessData(regions) { //regions[x][0] gives the chromosome; regions[x][1] gives the position; both are strings

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

		// var rsid = regions[2];
		// var loadCompletedWrapper = loadCompletedWrapper(rsid);

		
		// reader.getRecords(chr, parseInt(row[1]), parseInt(row[1]), loadCompletedWrapper);

	}, 50);

}

var loadCompleted = function(vcfData, rsid) {

	//replace the file rsids with the server rsids 

	combinedData[index] = vcfData;

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

	var allEmpty = true; 

	for (var i = 0; i < data.length; i++) {
		if (data[i].length != 0) {
			allEmpty = false; 
		}
	}


	if (typeof data === "undefined" || data.length <= 0 || allEmpty) {
		$("#details").html("<strong>Your files are missing the SNPs you requested.</strong>");
		console.log("No SNPs to fetch.");

		hideSpinner(); 
		updateProgressMessage("");
		return; 
	}


	$("#select").html("select your files"); 
	$("#fileTypeInfo").html("Please select a <a href=\"faq.html#Q4\" target=\"_blank\">compressed VCF</a> (<b>.vcf.gz</b>) and a <a href=\"faq.html#Q5\" target=\"_blank\">Tabix file</a> (<b>.tbi</b>)");

	accordionIndex = 0; 

	setiFrame("about:blank");
	fireAccordionPane(); 

}

function fireAccordionPane() {

	/* fetch batchSize SNPs from accordionIndex, unless that exceeds the bounds of the array */
	var end = (accordionIndex + batchSize >= combinedData.length) ? (combinedData.length - 1) : (accordionIndex + batchSize);

	setTimeout(function() {

		for (var i = accordionIndex; i <= end; i++) {

			var row = combinedData[i][0];

			if (typeof row === "undefined") {
				continue;
			}

			var split = row.split("\t");

			var serverRSID = regions[i][2];
			split[2] = serverRSID; //replace the file rsid with server rsid 

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

	// $("#accordion").css("background-color", "#EEECDD");
	// $("#infoiframe").css("border-color", "#EEECDD");

	$("#accordion").css("background-color", "#f2f2f2");
	$("#infoiframe").css("border-color", "#f2f2f2");
	// $("#cytobands").css("background-color", "#EEECDD");
	$("#infoiframe").addClass("showsBackground");
	$("#secondPanel").addClass("showsBorder");

	var HTML = ""; 

	HTML += "<h3 class=\"exp disabled\">"; 
		HTML += "<table>";
			HTML += "<tr id=\"override\">";
				HTML += "<td class=\"rsIDText\">SNP</td>";
				HTML += "<td class=\"geno\">Your Genotype</td>";
				HTML += "<td class=\"chromosome\">Chrom</td>";
				HTML += "<td class=\"cytoband\">Cytoband</td>";
			HTML += "</tr>";
		HTML += "</table>";
	HTML += "</h3>";

	HTML += "<div class=\"disabled\">";
	HTML += "</div>";


	accordionHTML = HTML + accordionHTML; 

}

function generateReport() { 

	makeHeader(); 

	$("#accordion").append(accordionHTML);
	$("#accordion").accordion("refresh");

	/* start drawing the cytobands*/ 
	getAllCytobands(); 

	writeReported(); 
}

function displaySNP(data) {

	var HTML = ""; 
	var extraData = catalog[data[2]]; 

	if ("or_beta" in extraData) { //extraData exists properly

		HTML += generateH3HTML(data, extraData, true); 

		HTML += generateInfoPaneHTML(data, extraData);

	} else { 

		HTML += generateH3HTML(data, extraData, false);

		HTML += generateButtonHTML(data);

	}

	accordionHTML += HTML; 

}

function generateInfoPaneHTML(data, extraData) {

	var HTML = ""; 

	var riskAllele = extraData["riskallele"]; 
	var magnitude = extraData["or_beta"];
	var genotype = getGenotype(data);

	var RAColor = getRAColor(genotype, riskAllele);

	/* if magnitude isn't there, link to FAQ */
	var formattedMagnitude = magnitude; 
	if (isNaN(magnitude) || (!magnitude && magnitude != 0)) {
		formattedMagnitude = "<a href=\"faq.html#Q21\" target=\"_blank\">?</a>"
	}

	/* format riskAllele with proper color */
	var formattedRiskAllele = "";
	if ($.inArray(riskAllele, ["A", "T", "C", "G"]) != -1) { 
		formattedRiskAllele = "<span class=\"RA-red\">" + riskAllele + "</span>";
	} else { 
		formattedRiskAllele = "<a href=\"faq.html#Q21\" target=\"_blank\">?</a>";
	}

	HTML += "<div>";

		HTML += "<div class=\"accordionDiv-extra " + RAColor + " \">";
			HTML += "<p class=\"oddsRatio\">Magnitude: " + formattedMagnitude + "</p>"; 
			HTML += "<p class=\"riskAllele\">Risk Allele: " + formattedRiskAllele + "</p>";
		HTML += "</div>";

		HTML += "<div>";
			HTML += generateButtonHTML(data);
		HTML += "</div>";

	HTML += "</div>";

	return HTML; 
	
}

function generateH3HTML(data, extraData, isAssociated) {

	var HTML = ""; 

	var genotype = getGenotype(data); 

	var chromosome = data[0]; 
	var position = data[1];
	var rsid = data[2];
	var band = extraData["band"];

	var id = "H3" + chromosome + "_" + position;
	h3IDs.push(id);

	var RAColor = ""; 
	var formattedGenotype = genotype; 

	if (isAssociated) {

		var riskAllele = extraData["riskallele"];
		RAColor = getRAColor(genotype, riskAllele);
		formattedGenotype = formatGenotype(genotype, RAColor); 

	}

	HTML += "<h3 class=\"exp " + RAColor + "\" id=\"" + id + "\">"; 
		HTML += "<table>";
			HTML += "<tr id=\"override\">";
				HTML += "<td class=\"rsIDText\">" + rsid + "</td>";
				HTML += "<td class=\"geno\">" + formattedGenotype + "</td>";
				HTML += "<td class=\"chromosome\">" + chromosome + "</td>";
				HTML += "<td class=\"cytoband\">" + band + "</td>";
			HTML += "</tr>";
		HTML += "</table>";
	HTML += "</h3>";

	return HTML; 
}

function generateButtonHTML(data) {

	var HTML = "";

	HTML += "<div class=\"accordionDiv-buttons\">";
		HTML += "<a id=\"override\" onclick=\"actionClicked(this);\" class=\"left action SNPedia\" target='infoiframe' href='http://www.snpedia.com/index.php/" + data[2].capitalize() + "'>SNPedia</a>";
		HTML += "<a id=\"override\" onclick=\"actionClicked(this);\" class=\"action\" target='infoiframe' href='http://www.ncbi.nlm.nih.gov/pubmed/?term=" + data[2] + "'>PubMed</a>";
		HTML += "<a id=\"override\" onclick=\"actionClicked(this);\" class=\"action\" target='infoiframe' href='http://www.ncbi.nlm.nih.gov/projects/SNP/snp_ref.cgi?rs=" + data[2].substring(data[2].indexOf("s") + 1) + "'>dbSNP</a>";
		HTML += "<a id=\"override\" onclick=\"actionClicked(this);\" class=\"action\" target='infoiframe' href='http://www.gwascentral.org/studies?page_size=50&q=" + data[2] + "&t=ZERO&m=all&l=all&format=html'>GWAS</a>";
		HTML += "<a id=\"override\" onclick=\"actionClicked(this);\" class=\"right action\" target='_blank' href='https://www.google.com/search?q=" + data[2] + "'>Google</a>";
	HTML += "</div>";

	return HTML; 

}

function getRAColor(genotype, riskAllele) {

	if (riskAllele === "?") {
		return "RA-black"; 
	} else if (genotype.includes(riskAllele)) { 
		return "RA-red";
	} else { 
		return "RA-green";
	}
}

function formatGenotype(genotype, RAColor) {

	return "<span class=\"" + RAColor + "\">" + genotype + "</span>";

}

function getGenotype(data) { 

	var binaryGenotype = data[9];
	binaryGenotype = binaryGenotype.substring(0, binaryGenotype.indexOf(":"));
	var reference = data[3];
	var alternate = data[4];

	/* determine the user's genotype in nucleotides */
	var genotype = ""; 
	if (binaryGenotype == "0/0") {
		genotype = reference + reference; 
	} else if (binaryGenotype == "1/1") {
		genotype = alternate + alternate; 
	} else if (binaryGenotype == "0/1") { 
		genotype = reference + alternate; 
	} else { 
		genotype = alternate + reference; 
	}

	return genotype;

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