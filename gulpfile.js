const path = require("path");
const gulp = require('gulp');
const webpack = require('gulp-webpack');
const ts = require("gulp-typescript");
const clean = require("gulp-clean");
const yargs = require("yargs");
const {exec, execSync} = require('child_process');
const rename = require('gulp-rename');
const sass = require('gulp-sass');

const args =  yargs.argv;

const contentFolder = 'dist';

gulp.task('clean', () => {
    return gulp.src([contentFolder, '*.vsix'])
        .pipe(clean());
})

// gulp.task('fix-vss', () => {
//     // These duplicate type files mess up the build
//     return gulp.src([`node_modules/vss-web-extension-sdk/node_modules`], {read: false})
//         .pipe(clean());
// });


gulp.task('copy', ['clean'], () => {
    gulp.src('node_modules/vss-web-extension-sdk/lib/VSS.SDK.min.js')
        .pipe(gulp.dest(contentFolder + '/scripts'));
    gulp.src('img/*').pipe(gulp.dest(`${contentFolder}/img`));

    return gulp.src([
        '*.html',
        '*.md',
        ])
        .pipe(gulp.dest(contentFolder));
});


gulp.task('webpack', ['copy'], () => {
    return execSync('webpack', {
        stdio: [null, process.stdout, process.stderr]
    });
});

gulp.task('package', ['webpack'], () => {
    const overrides = {}
    if (yargs.argv.release) {
        overrides.public = true;
    } else {
        const manifest = require('./vss-extension.json');
        overrides.name = manifest.name + ": Development Edition";
        overrides.id = manifest.id + "-dev";
    }
    const overridesArg = `--override "${JSON.stringify(overrides).replace(/"/g, '\\"')}"`;
    const rootArg = `--root ${contentFolder}`;
    const manifestsArg = `--manifests ..\\vss-extension.json`;

    exec(`tfx extension create ${rootArg} ${overridesArg} ${manifestsArg} --rev-version`,
        (err, stdout, stderr) => {
            if (err) {
                console.log(err);
            }

            console.log(stdout);
            console.log(stderr);
            
        });

});

gulp.task('default', ['package']);
