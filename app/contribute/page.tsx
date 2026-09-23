import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Share a Memory"
};

export default function ContributePage() {
  return (
    <section className="page-section contribute-layout">
      <div className="page-intro contribute-intro">
        <p className="eyebrow">SHARE A FAMILY MEMORY</p>
        <h1>Help Julianne learn the story.</h1>
        <p>
          Upload a photo or video, then tell us what you remember. You do not
          need an exact date or a perfect story—small details matter too.
        </p>

        <div className="keepsake-note">
          <strong>Good things to include</strong>
          <p>
            Who is in it? About when was it? Where were you? What happened
            before or after? Why does this moment matter to you?
          </p>
        </div>
      </div>

      <form className="memory-form">
        <fieldset>
          <legend>1. Add photos or video</legend>
          <label className="upload-zone">
            <span className="upload-icon">＋</span>
            <strong>Choose family media</strong>
            <span>Photos or videos from your phone or computer</span>
            <input type="file" multiple accept="image/*,video/*" />
          </label>
        </fieldset>

        <fieldset>
          <legend>2. Tell the story</legend>

          <label>
            Memory title
            <input
              type="text"
              name="title"
              placeholder="Grandma's graduation, Dad's first car..."
            />
          </label>

          <div className="form-row">
            <label>
              About when?
              <input type="text" name="date" placeholder="1976, Summer 1994..." />
            </label>
            <label>
              Where?
              <input
                type="text"
                name="place"
                placeholder="California, Manila, Grandma's house..."
              />
            </label>
          </div>

          <label>
            Who is in this memory?
            <input
              type="text"
              name="people"
              placeholder="Grandma, Grandpa, Aunt Maria..."
            />
          </label>

          <label>
            What should Julianne know about this?
            <textarea
              name="story"
              rows={7}
              placeholder="Tell the story the way you would tell it sitting together at the kitchen table..."
            />
          </label>
        </fieldset>

        <fieldset>
          <legend>3. Your part in the story</legend>
          <label>
            Your name
            <input type="text" name="contributor" placeholder="Your name" />
          </label>
          <p className="form-help">
            In the working family site, submissions will go to a private
            review queue before joining the archive.
          </p>
        </fieldset>

        <button type="button" className="button button-primary button-wide">
          Save this memory
        </button>
      </form>
    </section>
  );
}
