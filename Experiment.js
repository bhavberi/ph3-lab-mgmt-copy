const path = require("path");
const fs = require("fs");
const { renderMarkdown } = require("./renderer.js");
const process = require("process");
const shell = require("shelljs");

const Config = require("./Config.js");
const { LearningUnit } = require("./LearningUnit.js");
const { Task } = require("./Task.js");
const {
  UnitTypes,
  ContentTypes,
  BuildEnvs,
  PluginScope,
} = require("./Enums.js");
const { Plugin } = require("./plugin");

class Experiment {
  constructor(src) {
    this.src = src;
    this.descriptor = require(Experiment.descriptorPath(src));
  }

  static ui_template_path = path.resolve(__dirname, Config.Experiment.ui_template_name);

  static static_content_path = path.resolve(
    __dirname,
    Config.Experiment.static_content_dir
  );

  static descriptorPath(src) {
    return path.resolve(src, Config.Experiment.descriptor_name);
  }

  static contributorsPath(src) {
    return path.resolve(`${src}/experiment`, 'contributors.md');
  }

  static registerPartials(hb) {
    Config.Experiment.partials.forEach(([name, file]) => {
      const partial_content = fs.readFileSync(
        path.resolve(
          Experiment.ui_template_path,
          "partials",
          `${file}.handlebars`
        )
      );
      hb.registerPartial(name, partial_content.toString());
    });
  }

  init(hb) {
    try {
      const bp = Config.build_path(this.src);
      shell.mkdir(path.resolve(this.src, Config.Experiment.build_dir));
      shell.cp("-R", path.resolve(this.src, Config.Experiment.exp_dir), bp);
      shell.cp("-R", path.resolve(Experiment.ui_template_path, "assets"), bp);

      // Copy the Katex CSS and fonts to the build directory in assets/katex_assets
      shell.mkdir(path.resolve(bp, "assets", "katex_assets"));
      shell.cp(
        "-R",
        path.resolve("node_modules", "katex", "dist", "katex.min.css"),
        path.resolve(bp, "assets", "katex_assets")
      );
      shell.cp(
        "-R",
        path.resolve("node_modules", "katex", "dist", "fonts"),
        path.resolve(bp, "assets", "katex_assets")
      );


      shell.cp(
        "-R",
        path.resolve(Experiment.static_content_path, "feedback.md"),
        bp
      );
      Experiment.registerPartials(hb);
    } catch (e) {
      console.error(e);
      process.exit();
    }
  }

  validate(build_options) {
    const buildPath = Config.build_path(this.src);
    const expPath = path.resolve(this.src, Config.Experiment.exp_dir);
    if (build_options.isESLINT) {
      shell.exec(
        `npx eslint -c ${__dirname}/.eslintrc.js ${expPath} > ${buildPath}/eslint.log`
      );
    }
    if (build_options.isExpDesc) {
      const descriptor = require(Experiment.descriptorPath(this.src));
      shell.exec(
        `node ${__dirname}/validation/validate.js -f ${descriptor} >> ${buildPath}/validate.log`
      );
      // loop through the units and validate the content
      descriptor.units.forEach((unit) => {
        // if content type is assessment, then validate the assessment
        if (unit["content-type"] === "assesment") {
          const assesmentPath = path.resolve(expPath, unit.source);
          if (fs.existsSync(assesmentPath)){
            shell.exec(
              `echo =${unit.source} >> ${buildPath}/assesment.log`
            );
            shell.exec(
              `node ${__dirname}/validation/validate.js -f ${assesmentPath} >> ${buildPath}/assesment.log`
            );
          }else{
            console.error(`Assesment file ${assesmentPath} does not exist`);
          }
        }
      });
    }
  }
  name() {
    const name_file = fs.readFileSync(
      path.resolve(Config.build_path(this.src), "experiment-name.md")
    );
    return renderMarkdown(name_file.toString());
  }

  build(hb, lab_data, options) {
    /*
    here we are assuming that the descriptor contains a simgle object
    that represents the learning unit corresponding to the experiment.
    */
    const explu = LearningUnit.fromRecord(this.descriptor, this.src);
    const exp_info = {
      name: this.name(),
      menu: explu.units,
      src: this.src,
      bp: Config.build_path(this.src) + "/",
    };

    if (options.plugins) {
      exp_info.plugins = Plugin.processExpScopePlugins(
        exp_info,
        hb,
        lab_data,
        options
      );
    }
    explu.build(exp_info, lab_data, options);
    // post build
    if (options.plugins) {
      Plugin.processPostBuildPlugins(exp_info, options);
    }
    /*
      This "tmp" directory is needed because when you have a sub-directory
      with the same name, it can cause issue.  So, we assume that there should
      not be any sub-directory with "tmp" name, and first move the contents to tmp
      before moving the contents to the top level directory.
     */
    const tmp_dir = path.resolve(this.src, Config.Experiment.build_dir, "tmp");
    shell.mv(path.resolve(Config.build_path(this.src)), tmp_dir);
    shell.mv(
      path.resolve(tmp_dir, "*"),
      path.resolve(this.src, Config.Experiment.build_dir)
    );
    shell.rm("-rf", tmp_dir);
  }

  includeFeedback() {
    const feedbackLU = {
      "unit-type": "task",
      label: "Feedback",
      "content-type": "text",
      source: "feedback.md",
      target: "feedback.html",
    };

    this.descriptor.units.push(feedbackLU);
  }

  includeContributors() {
    const contributors = {
      "unit-type": "task",
      label: "Contributors",
      "content-type": "text",
      source: "contributors.md",
      target: "contributors.html",
    };
    this.descriptor.units.push(contributors);
  }
}

module.exports = { Experiment };

// need to handle optional menu items

/*

TODO

Removing this becaiuse it is optional and we have not yet handled
the case.

    {
      "target": "posttest.html",
      "source": "posttest.js",
      "label": "Posttest",
      "unit-type": "task",
      "content-type": "assesment"
    },

*/
