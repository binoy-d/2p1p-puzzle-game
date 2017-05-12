import java.io.File;
import java.io.IOException;
 
import javax.sound.sampled.AudioFormat;
import javax.sound.sampled.AudioInputStream;
import javax.sound.sampled.AudioSystem;
import javax.sound.sampled.Clip;
import javax.sound.sampled.DataLine;
import javax.sound.sampled.LineEvent;
import javax.sound.sampled.LineListener;
import javax.sound.sampled.LineUnavailableException;
import javax.sound.sampled.UnsupportedAudioFileException;
 
/**
 * This is an example program that demonstrates how to play back an audio file
 * using the Clip in Java Sound API.
 * @author www.codejava.net
 *
 */
public class AudioPlayerExample1 implements LineListener {
     int p = 0;
       int bpm = 370;
     Game parent;
    /**
     * this flag indicates whether the playback completes or not.
     */
    boolean playCompleted;

    /**
     * Play a given audio file.
     * @param audioFilePath Path of the audio file.
     */
    public AudioPlayerExample1(Game g){
     parent = g; 
    }
    void play(String audioFilePath) {
        File audioFile = new File(audioFilePath);
 
        try {
            AudioInputStream audioStream = AudioSystem.getAudioInputStream(audioFile);
 
            AudioFormat format = audioStream.getFormat();
 
            DataLine.Info info = new DataLine.Info(Clip.class, format);
 
            Clip audioClip = (Clip) AudioSystem.getLine(info);
 
            audioClip.addLineListener(this);
            int length = audioClip.getFrameLength();
            audioClip.open(audioStream);
             
            audioClip.loop(-1);
             
            while (!playCompleted) {
                // wait for the playback completes
                try {
                  parent.tick();
                  Thread.sleep(bpm);
                  
                } catch (InterruptedException ex) {
                }
            }
             
            audioClip.close();
             
        } catch (UnsupportedAudioFileException ex) {
        } catch (LineUnavailableException ex) {
        } catch (IOException ex) {}
         
    }

    @Override
    public void update(LineEvent event) {
        LineEvent.Type type = event.getType();
         
        if (type == LineEvent.Type.START) {
            System.out.println("Playback started.");
             
        } else if (type == LineEvent.Type.STOP) {
            //playCompleted = true;
            System.out.println("Playback completed.");
            
        }
 
    }
 

 
}