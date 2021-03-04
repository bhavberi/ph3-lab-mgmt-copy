const shell = require("shelljs");
const path = require("path");
const fs = require("fs");
const { JSDOM } = require("jsdom");

const {buildPages} = require("./renderpage.js");

function copySources(repo_root, build_root) {
    
    const repo_dir = path.join( repo_root, "experiment" );
    const build_dir = path.join( build_root );
    const round_template_dir = path.join( build_root, "round-template" );
    const exp_content_dir = path.join( round_template_dir, "experiment" );
    
    shell.rm( "-rf", exp_content_dir );
    try {
	fs.accessSync( build_dir , fs.constants.W_OK);
    }
    catch (err) {
	shell.mkdir( "-p", round_template_dir );
    }
    shell.cp( "-R", repo_dir,  round_template_dir );
}


function copyPages(repo_root, build_root) {
    
    const repo_dir = path.join( repo_root, "experiment" );
    const build_dir = path.join( build_root );
  try {
    shell.cp( "-R", "templates/assets", build_dir );
    shell.cp( "-R", path.join(repo_dir, "images"), build_dir );
  }
  catch(e) {
    console.log(e.message);
  }
}


function insertIframeResizer(repo_root, build_root) {
    let sim_index = fs.readFileSync(path.join( build_root, "round-template/experiment/simulation/index.html" ));
    let dom = new JSDOM(sim_index);
    let iframeScript = dom.window.document.createElement("script");
    iframeScript.src = "./iframeResize.js";
  dom.window.document.body.appendChild(iframeScript);
    fs.writeFileSync(path.join( build_root, "round-template/experiment/simulation/index.html" ), dom.serialize());
    shell.cp(path.join( build_root, "assets/js/iframeResize.js" ),
	     path.join( build_root, "round-template/experiment/simulation/"));
}


function buildExp(repo_root, build_root, data, prod, e) {
    copySources(repo_root, build_root);
    buildPages( repo_root, build_root, data, prod, e);
    copyPages(repo_root, build_root);
  insertIframeResizer(repo_root, build_root);
}

exports.buildExp = buildExp;

if (require.main === module) {
    const repo_root = "../";
    const build_root = "../build";
    buildExp(repo_root, build_root, {}, false);
}